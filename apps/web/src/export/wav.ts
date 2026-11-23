import * as Tone from 'tone'
import { DURATION_BEATS } from '../core/rhythm'
import {
  expandChordBarPlay,
  styleForBar,
} from '../core/chords/playStyle'
import type {
  ChordBar,
  ChordPlayStyleId,
  DrumPhrase,
  LayerKind,
  MixerState,
} from '../core/projectTypes'
import type { Phrase } from '../core/types'
import {
  createDefaultTones,
  type ToneId,
  type ToneMap,
} from '../core/tones/presets'
import { createBass, createChordVoices, createLead, createMasterBus } from '../audio/voices'
import type { WavLayers } from './layers'

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const bitDepth = 16
  const samples = buffer.length
  const blockAlign = (numChannels * bitDepth) / 8
  const byteRate = sampleRate * blockAlign
  const dataSize = samples * blockAlign
  const arrayBuffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(arrayBuffer)

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)

  const channels: Float32Array[] = []
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c))
  }

  let offset = 44
  for (let i = 0; i < samples; i++) {
    for (let c = 0; c < numChannels; c++) {
      let sample = Math.max(-1, Math.min(1, channels[c]![i]!))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' })
}

function phraseDurationSec(phrases: Phrase[]): number {
  let sec = 0
  for (const phrase of phrases) {
    const beatSec = 60 / Math.max(1, phrase.bpm)
    for (const note of phrase.notes) {
      sec += DURATION_BEATS[note.duration] * beatSec
    }
  }
  return sec
}

function chordsDurationSec(chords: ChordBar[]): number {
  let sec = 0
  for (const bar of chords) {
    sec += (60 / Math.max(1, bar.bpm)) * 4
  }
  return sec
}

function drumsDurationSec(phrases: DrumPhrase[]): number {
  let sec = 0
  for (const phrase of phrases) {
    sec += (60 / Math.max(1, phrase.bpm)) * 4 * phrase.bars
  }
  return sec
}

export type { WavLayers } from './layers'
export { filterLayersByInclude } from './layers'

function mixDurationSec(layers: WavLayers): number {
  const raw = Math.max(
    phraseDurationSec(layers.melody ?? []),
    chordsDurationSec(layers.chords ?? []),
    phraseDurationSec(layers.bass ?? []),
    drumsDurationSec(layers.drums ?? []),
    0.5,
  )
  // Cap to avoid runaway Offline renders
  return Math.min(raw + 0.4, 180)
}

function audibleGain(kind: LayerKind, mixer: MixerState): number {
  const anySolo = Object.values(mixer.solo).some(Boolean)
  const audible = anySolo ? mixer.solo[kind] : !mixer.mute[kind]
  return audible ? mixer.volume[kind] : 0
}

function toAudioBuffer(rendered: unknown): AudioBuffer {
  if (
    rendered &&
    typeof rendered === 'object' &&
    typeof (rendered as { get?: () => AudioBuffer }).get === 'function'
  ) {
    return (rendered as { get: () => AudioBuffer }).get()
  }
  if (
    rendered &&
    typeof rendered === 'object' &&
    typeof (rendered as AudioBuffer).getChannelData === 'function'
  ) {
    return rendered as AudioBuffer
  }
  throw new Error('Offline render did not return an AudioBuffer')
}

/** Master bus of the render in progress (set inside each Tone.Offline callback). */
let bus: Tone.Gain | null = null
function out(): Tone.Gain {
  if (!bus) bus = createMasterBus()
  return bus
}

function scheduleMonoMelody(
  phrases: Phrase[],
  volume: number,
  tone: ToneId,
): void {
  if (volume <= 0 || phrases.length === 0) return
  const gain = new Tone.Gain(volume).connect(out())
  const synth = createLead(tone).connect(gain)
  let t = 0
  for (const phrase of phrases) {
    const beatSec = 60 / Math.max(1, phrase.bpm)
    for (const note of phrase.notes) {
      const durSec = DURATION_BEATS[note.duration] * beatSec
      if (!note.rest) {
        const freq = Tone.Frequency(note.pitch, 'midi').toFrequency()
        synth.triggerAttackRelease(freq, Math.max(0.05, durSec * 0.9), t)
      }
      t += durSec
    }
  }
}

function scheduleChords(
  chords: ChordBar[],
  volume: number,
  playStyle: ChordPlayStyleId = 'block',
  tone: ToneId = 'piano',
): void {
  if (volume <= 0 || chords.length === 0) return
  const gain = new Tone.Gain(volume).connect(out())
  // Separate synths to avoid PolySynth Offline quirks. Each note takes the
  // lowest voice that has finished ringing, so short notes keep reusing one
  // voice (cheap to render) and only overlapping notes open more voices.
  // A voice counts as free once its gate ends; retriggering it during the
  // release tail is inaudible and keeps the render fast.
  const voices = createChordVoices(tone, 5).map((synth) => synth.connect(gain))
  const freeAt = voices.map(() => 0)
  const takeVoice = (at: number): number => {
    let best = 0
    for (let v = 0; v < voices.length; v++) {
      if (freeAt[v]! <= at) return v
      if (freeAt[v]! < freeAt[best]!) best = v
    }
    return best
  }
  let t = 0
  for (const bar of chords) {
    const beatSec = 60 / Math.max(1, bar.bpm)
    const durSec = 4 * beatSec
    const style = styleForBar(bar, playStyle)
    const events = expandChordBarPlay(bar, style)
    for (const ev of events) {
      const gate = Math.max(0.05, ev.durationBeats * beatSec * 0.95)
      const at = t + ev.timeBeat * beatSec
      for (const p of ev.pitches) {
        const freq = Tone.Frequency(p, 'midi').toFrequency()
        const v = takeVoice(at)
        voices[v]!.triggerAttackRelease(freq, gate, at)
        freeAt[v] = at + gate
      }
    }
    t += durSec
  }
}

function scheduleBass(phrases: Phrase[], volume: number, tone: ToneId): void {
  if (volume <= 0 || phrases.length === 0) return
  const gain = new Tone.Gain(volume).connect(out())
  const synth = createBass(tone).connect(gain)
  let t = 0
  for (let pi = 0; pi < phrases.length; pi++) {
    const phrase = phrases[pi]!
    const beatSec = 60 / Math.max(1, phrase.bpm)
    const notes = phrase.notes
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i]!
      const durSec = DURATION_BEATS[note.duration] * beatSec
      if (!note.rest) {
        let nextPitch: number | undefined
        for (let j = i + 1; j < notes.length; j++) {
          if (notes[j]!.rest) break
          nextPitch = notes[j]!.pitch
          break
        }
        if (nextPitch === undefined && phrases[pi + 1]) {
          for (const n of phrases[pi + 1]!.notes) {
            if (n.rest) break
            nextPitch = n.pitch
            break
          }
        }
        const sameNext = nextPitch === note.pitch
        const gap = sameNext
          ? Math.min(0.035, Math.max(0.018, durSec * 0.12))
          : durSec * 0.04
        const gate = Math.max(0.03, durSec - gap)
        const freq = Tone.Frequency(note.pitch, 'midi').toFrequency()
        synth.triggerAttackRelease(freq, gate, t)
      }
      t += durSec
    }
  }
}

/** Offline start times must be > 0 for these voices. */
const DRUM_LEAD_SEC = 0.01
/** Live playback fires hats at this velocity, on top of the voice's -12 dB. */
const HAT_VELOCITY = 0.3

type DrumKind = 'kick' | 'snare' | 'hat'
type DrumCue = { at: number; buffer: Tone.ToneAudioBuffer }

/** One hit of the same voice live playback uses, rendered on its own. */
async function renderDrumHit(kind: DrumKind, dur: number): Promise<Tone.ToneAudioBuffer> {
  return Tone.Offline(() => {
    if (kind === 'kick') {
      new Tone.MembraneSynth({
        envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.1 },
      })
        .toDestination()
        .triggerAttackRelease('C1', dur, DRUM_LEAD_SEC)
    } else if (kind === 'snare') {
      new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.05 },
      })
        .toDestination()
        .triggerAttackRelease(dur, DRUM_LEAD_SEC)
    } else {
      const hat = new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.08, release: 0.01 },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 4000,
        octaves: 1.5,
      }).toDestination()
      hat.volume.value = -12
      hat.triggerAttackRelease(DRUM_LEAD_SEC, dur, HAT_VELOCITY)
    }
  }, dur + 0.7)
}

/**
 * Drum hits are rendered one by one with the live voices (those synths cannot
 * fire repeatedly inside a single offline render), then placed as samples.
 */
async function prepareDrums(phrases: DrumPhrase[]): Promise<DrumCue[]> {
  const raw: { at: number; kind: DrumKind; dur: number }[] = []
  let t0 = 0
  for (const phrase of phrases) {
    const beatSec = 60 / Math.max(1, phrase.bpm)
    for (const hit of phrase.hits) {
      const dur = DURATION_BEATS[hit.duration] * beatSec
      raw.push({
        at: t0 + hit.beat * beatSec,
        kind: hit.instrument === 'kick' ? 'kick' : hit.instrument === 'snare' ? 'snare' : 'hat',
        dur: hit.instrument === 'hat' ? Math.max(0.03, dur * 0.5) : Math.max(0.05, dur),
      })
    }
    t0 += phrase.bars * 4 * beatSec
  }
  const cache = new Map<string, Promise<Tone.ToneAudioBuffer>>()
  const cues: DrumCue[] = []
  for (const r of raw) {
    const key = `${r.kind}:${r.dur.toFixed(3)}`
    let pending = cache.get(key)
    if (!pending) {
      pending = renderDrumHit(r.kind, r.dur)
      cache.set(key, pending)
    }
    cues.push({ at: r.at, buffer: await pending })
  }
  return cues
}

function scheduleDrums(cues: DrumCue[], volume: number): void {
  if (volume <= 0 || cues.length === 0) return
  const gain = new Tone.Gain(volume).connect(out())
  for (const cue of cues) {
    const src = new Tone.ToneBufferSource(cue.buffer).connect(gain)
    const start = cue.at - DRUM_LEAD_SEC
    if (start >= 0) src.start(start)
    else src.start(0, -start)
  }
}

export async function renderMixWavBlob(
  layers: WavLayers,
  mixer: MixerState,
  chordPlayStyle: ChordPlayStyleId = 'block',
  tones: ToneMap = createDefaultTones(),
): Promise<Blob> {
  const duration = mixDurationSec(layers)
  const drumCues = layers.drums?.length ? await prepareDrums(layers.drums) : []
  const rendered = await Tone.Offline(() => {
    bus = createMasterBus()
    if (layers.melody?.length) {
      scheduleMonoMelody(
        layers.melody,
        audibleGain('melody', mixer),
        tones.melody,
      )
    }
    if (layers.chords?.length) {
      scheduleChords(
        layers.chords,
        audibleGain('chords', mixer),
        chordPlayStyle,
        tones.chords,
      )
    }
    if (layers.bass?.length) {
      scheduleBass(layers.bass, audibleGain('bass', mixer), tones.bass)
    }
    if (layers.drums?.length) {
      scheduleDrums(drumCues, audibleGain('drums', mixer))
    }
  }, duration)
  bus = null

  return audioBufferToWav(toAudioBuffer(rendered))
}

function totalDurationSec(phrases: Phrase[]): number {
  return Math.max(0.5, phraseDurationSec(phrases) + 0.35)
}

export async function renderWavBlob(
  phrases: Phrase[],
  tone: ToneId = 'piano',
): Promise<Blob> {
  const duration = totalDurationSec(phrases)
  const rendered = await Tone.Offline(() => {
    const synth = createLead(tone).connect(createMasterBus())

    let t = 0
    for (const phrase of phrases) {
      const beatSec = 60 / Math.max(1, phrase.bpm)
      for (const note of phrase.notes) {
        const durSec = DURATION_BEATS[note.duration] * beatSec
        if (!note.rest) {
          const freq = Tone.Frequency(note.pitch, 'midi').toFrequency()
          synth.triggerAttackRelease(freq, Math.max(0.05, durSec * 0.9), t)
        }
        t += durSec
      }
    }
  }, duration)

  return audioBufferToWav(toAudioBuffer(rendered))
}

export async function downloadWav(
  phrases: Phrase[],
  filename = 'melody.wav',
  tone: ToneId = 'piano',
): Promise<void> {
  const blob = await renderWavBlob(phrases, tone)
  triggerDownload(blob, filename)
}

export async function downloadMixWav(
  layers: WavLayers,
  mixer: MixerState,
  filename = 'arrangement.wav',
  chordPlayStyle: ChordPlayStyleId = 'block',
  tones: ToneMap = createDefaultTones(),
): Promise<void> {
  const hasAny =
    (layers.melody?.length ?? 0) > 0 ||
    (layers.chords?.length ?? 0) > 0 ||
    (layers.bass?.length ?? 0) > 0 ||
    (layers.drums?.length ?? 0) > 0
  if (!hasAny) {
    throw new Error('書き出すレイヤが空です')
  }
  const blob = await renderMixWavBlob(layers, mixer, chordPlayStyle, tones)
  triggerDownload(blob, filename)
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

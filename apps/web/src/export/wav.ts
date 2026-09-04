import * as Tone from 'tone'
import { DURATION_BEATS } from '../core/rhythm'
import { chordPitches } from '../core/chords/theory'
import type {
  ChordBar,
  DrumPhrase,
  LayerIncludeState,
  LayerKind,
  MixerState,
} from '../core/projectTypes'
import type { Phrase } from '../core/types'

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

export type WavLayers = {
  melody?: Phrase[]
  chords?: ChordBar[]
  bass?: Phrase[]
  drums?: DrumPhrase[]
}

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

function scheduleMonoMelody(
  phrases: Phrase[],
  volume: number,
): void {
  if (volume <= 0 || phrases.length === 0) return
  const gain = new Tone.Gain(volume).toDestination()
  const synth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.25 },
  }).connect(gain)
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

function scheduleChords(chords: ChordBar[], volume: number): void {
  if (volume <= 0 || chords.length === 0) return
  const gain = new Tone.Gain(volume).toDestination()
  // Use 3 separate Synths to avoid PolySynth Offline quirks
  const s1 = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.02, decay: 0.25, sustain: 0.4, release: 0.35 },
  }).connect(gain)
  const s2 = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.02, decay: 0.25, sustain: 0.4, release: 0.35 },
  }).connect(gain)
  const s3 = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.02, decay: 0.25, sustain: 0.4, release: 0.35 },
  }).connect(gain)
  const voices = [s1, s2, s3]
  let t = 0
  for (const bar of chords) {
    const beatSec = 60 / Math.max(1, bar.bpm)
    const durSec = 4 * beatSec
    const pitches = chordPitches(bar)
    pitches.forEach((p, i) => {
      const freq = Tone.Frequency(p, 'midi').toFrequency()
      voices[i]?.triggerAttackRelease(freq, Math.max(0.1, durSec * 0.95), t)
    })
    t += durSec
  }
}

function scheduleBass(phrases: Phrase[], volume: number): void {
  if (volume <= 0 || phrases.length === 0) return
  const gain = new Tone.Gain(volume * 2.2).toDestination()
  const synth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.005, decay: 0.01, sustain: 1, release: 0.03 },
  }).connect(gain)
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

function scheduleDrums(phrases: DrumPhrase[], volume: number): void {
  if (volume <= 0 || phrases.length === 0) return
  const gain = new Tone.Gain(volume).toDestination()
  // Avoid MetalSynth/NoiseSynth Offline issues — use simple pitched hits
  const kick = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.05 },
  }).connect(gain)
  const snare = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.04 },
  }).connect(gain)
  const hat = new Tone.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
  }).connect(gain)
  hat.volume.value = -18
  snare.volume.value = -8

  let t0 = 0
  for (const phrase of phrases) {
    const beatSec = 60 / Math.max(1, phrase.bpm)
    for (const hit of phrase.hits) {
      const t = t0 + hit.beat * beatSec
      const dur = Math.max(0.03, DURATION_BEATS[hit.duration] * beatSec)
      if (hit.instrument === 'kick') {
        kick.triggerAttackRelease(60, dur, t)
      } else if (hit.instrument === 'snare') {
        snare.triggerAttackRelease(200, dur * 0.6, t)
      } else {
        hat.triggerAttackRelease(8000, dur * 0.4, t)
      }
    }
    t0 += phrase.bars * 4 * beatSec
  }
}

export async function renderMixWavBlob(
  layers: WavLayers,
  mixer: MixerState,
): Promise<Blob> {
  const duration = mixDurationSec(layers)
  const rendered = await Tone.Offline(() => {
    if (layers.melody?.length) {
      scheduleMonoMelody(layers.melody, audibleGain('melody', mixer))
    }
    if (layers.chords?.length) {
      scheduleChords(layers.chords, audibleGain('chords', mixer))
    }
    if (layers.bass?.length) {
      scheduleBass(layers.bass, audibleGain('bass', mixer))
    }
    if (layers.drums?.length) {
      scheduleDrums(layers.drums, audibleGain('drums', mixer))
    }
  }, duration)

  return audioBufferToWav(toAudioBuffer(rendered))
}

function totalDurationSec(phrases: Phrase[]): number {
  return Math.max(0.5, phraseDurationSec(phrases) + 0.35)
}

export async function renderWavBlob(phrases: Phrase[]): Promise<Blob> {
  const duration = totalDurationSec(phrases)
  const rendered = await Tone.Offline(() => {
    const synth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.25 },
    }).toDestination()

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
): Promise<void> {
  const blob = await renderWavBlob(phrases)
  triggerDownload(blob, filename)
}

export async function downloadMixWav(
  layers: WavLayers,
  mixer: MixerState,
  filename = 'arrangement.wav',
): Promise<void> {
  const hasAny =
    (layers.melody?.length ?? 0) > 0 ||
    (layers.chords?.length ?? 0) > 0 ||
    (layers.bass?.length ?? 0) > 0 ||
    (layers.drums?.length ?? 0) > 0
  if (!hasAny) {
    throw new Error('書き出すレイヤが空です')
  }
  const blob = await renderMixWavBlob(layers, mixer)
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

export function filterLayersByInclude(
  layers: WavLayers,
  include: LayerIncludeState,
): WavLayers {
  return {
    melody: include.melody && layers.melody?.length ? layers.melody : undefined,
    chords: include.chords && layers.chords?.length ? layers.chords : undefined,
    bass: include.bass && layers.bass?.length ? layers.bass : undefined,
    drums: include.drums && layers.drums?.length ? layers.drums : undefined,
  }
}

import * as Tone from 'tone'
import { DURATION_BEATS } from '../core/rhythm'
import { chordPitches } from '../core/chords/theory'
import { drumInstrumentMidi } from '../core/drums/generate'
import type { ChordBar, DrumPhrase, MixerState, LayerKind } from '../core/projectTypes'
import type { Phrase } from '../core/types'

let poly: Tone.PolySynth | null = null
let bassSynth: Tone.Synth | null = null
let kick: Tone.MembraneSynth | null = null
let snare: Tone.NoiseSynth | null = null
let hat: Tone.MetalSynth | null = null
let endTimer: ReturnType<typeof setTimeout> | null = null
let playing = false
const gains: Partial<Record<LayerKind, Tone.Gain>> = {}

function layerGain(kind: LayerKind): Tone.Gain {
  if (!gains[kind]) {
    gains[kind] = new Tone.Gain(1).toDestination()
  }
  return gains[kind]!
}

function getPoly(): Tone.PolySynth {
  if (!poly) {
    poly = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.15, sustain: 0.35, release: 0.25 },
    }).connect(layerGain('melody'))
  }
  return poly
}

function getBass(): Tone.Synth {
  if (!bassSynth) {
    // Triangle + partials: flat level, but audible on small speakers
    // (pure sine at octave 2 is often inaudible)
    bassSynth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 0.01, sustain: 1, release: 0.03 },
    }).connect(layerGain('bass'))
    bassSynth.volume.value = 8
  }
  return bassSynth
}

function getKick(): Tone.MembraneSynth {
  if (!kick) {
    kick = new Tone.MembraneSynth({
      envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.1 },
    }).connect(layerGain('drums'))
  }
  return kick
}

function getSnare(): Tone.NoiseSynth {
  if (!snare) {
    snare = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.05 },
    }).connect(layerGain('drums'))
  }
  return snare
}

function getHat(): Tone.MetalSynth {
  if (!hat) {
    hat = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.08, release: 0.01 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
    }).connect(layerGain('drums'))
    hat.volume.value = -12
  }
  return hat
}

function getChordPoly(): Tone.PolySynth {
  // Reuse melody poly connected via a separate gain — use same poly with chords gain
  // Create dedicated chord synth
  return getOrCreateChordPoly()
}

let chordPoly: Tone.PolySynth | null = null
function getOrCreateChordPoly(): Tone.PolySynth {
  if (!chordPoly) {
    chordPoly = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.4 },
    }).connect(layerGain('chords'))
  }
  return chordPoly
}

export async function ensureAudio(): Promise<void> {
  await Tone.start()
  getPoly()
  getBass()
  getKick()
  getSnare()
  getHat()
  getOrCreateChordPoly()
}

export function isPlaying(): boolean {
  return playing
}

export async function stopPlayback(): Promise<void> {
  if (endTimer != null) {
    clearTimeout(endTimer)
    endTimer = null
  }
  // Mute immediately so any already-scheduled audio is inaudible
  for (const kind of ['melody', 'chords', 'bass', 'drums'] as LayerKind[]) {
    if (gains[kind]) gains[kind]!.gain.value = 0
  }
  // Dispose instruments — cancels future triggerAttackRelease events
  poly?.dispose()
  chordPoly?.dispose()
  bassSynth?.dispose()
  kick?.dispose()
  snare?.dispose()
  hat?.dispose()
  poly = null
  chordPoly = null
  bassSynth = null
  kick = null
  snare = null
  hat = null
  playing = false
}

function applyMixer(mixer: MixerState): void {
  const anySolo = Object.values(mixer.solo).some(Boolean)
  for (const kind of ['melody', 'chords', 'bass', 'drums'] as LayerKind[]) {
    const g = layerGain(kind)
    const audible = anySolo ? mixer.solo[kind] : !mixer.mute[kind]
    g.gain.value = audible ? mixer.volume[kind] : 0
  }
}

function peekNextSoundingPitch(
  notes: Phrase['notes'],
  fromIndex: number,
): number | undefined {
  for (let j = fromIndex; j < notes.length; j++) {
    if (notes[j].rest) return undefined
    return notes[j].pitch
  }
  return undefined
}

function noteGateSec(
  durSec: number,
  samePitchNext: boolean,
  usePoly: boolean,
): number {
  if (usePoly) return Math.max(0.05, durSec * 0.9)
  if (samePitchNext) {
    // Brief silence so repeated pitches re-attack clearly
    const gap = Math.min(0.035, Math.max(0.018, durSec * 0.12))
    return Math.max(0.03, durSec - gap)
  }
  return Math.max(0.05, durSec * 0.96)
}

function schedulePhrasesMono(
  synth: Tone.Synth | Tone.PolySynth,
  phrases: Phrase[],
  startTime: number,
  usePoly: boolean,
): number {
  let t = startTime
  for (let pi = 0; pi < phrases.length; pi++) {
    const phrase = phrases[pi]!
    const beatSec = 60 / Math.max(1, phrase.bpm)
    const notes = phrase.notes
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i]!
      const durSec = DURATION_BEATS[note.duration] * beatSec
      if (!note.rest) {
        let nextPitch = peekNextSoundingPitch(notes, i + 1)
        if (nextPitch === undefined && !usePoly && phrases[pi + 1]) {
          nextPitch = peekNextSoundingPitch(phrases[pi + 1]!.notes, 0)
        }
        const sameNext = !usePoly && nextPitch === note.pitch
        const freq = Tone.Frequency(note.pitch, 'midi').toFrequency()
        const gate = noteGateSec(durSec, sameNext, usePoly)
        if (usePoly) {
          ;(synth as Tone.PolySynth).triggerAttackRelease(freq, gate, t)
        } else {
          ;(synth as Tone.Synth).triggerAttackRelease(freq, gate, t)
        }
      }
      t += durSec
    }
  }
  return t
}

function scheduleChords(chords: ChordBar[], startTime: number): number {
  const synth = getChordPoly()
  let t = startTime
  for (const bar of chords) {
    const beatSec = 60 / Math.max(1, bar.bpm)
    const durSec = 4 * beatSec
    const pitches = chordPitches(bar)
    const freqs = pitches.map((p) =>
      Tone.Frequency(p, 'midi').toFrequency(),
    )
    synth.triggerAttackRelease(freqs, Math.max(0.1, durSec * 0.95), t)
    t += durSec
  }
  return t
}

function scheduleDrums(phrases: DrumPhrase[], startTime: number): number {
  let end = startTime
  let t0 = startTime
  for (const phrase of phrases) {
    const beatSec = 60 / Math.max(1, phrase.bpm)
    for (const hit of phrase.hits) {
      const t = t0 + hit.beat * beatSec
      const dur = DURATION_BEATS[hit.duration] * beatSec
      if (hit.instrument === 'kick') {
        getKick().triggerAttackRelease('C1', Math.max(0.05, dur), t)
      } else if (hit.instrument === 'snare') {
        getSnare().triggerAttackRelease(Math.max(0.05, dur), t)
      } else {
        getHat().triggerAttackRelease(Math.max(0.03, dur * 0.5), t, 0.3)
      }
      end = Math.max(end, t + dur)
    }
    t0 += phrase.bars * 4 * beatSec
    end = Math.max(end, t0)
  }
  return end
}

export type LayerPlayback = {
  melody?: Phrase[]
  chords?: ChordBar[]
  bass?: Phrase[]
  drums?: DrumPhrase[]
}

export async function playLayers(
  layers: LayerPlayback,
  mixer: MixerState,
  onEnd?: () => void,
): Promise<void> {
  await ensureAudio()
  await stopPlayback()
  applyMixer(mixer)

  const start = Tone.now() + 0.05
  let end = start

  if (layers.melody?.length) {
    end = Math.max(
      end,
      schedulePhrasesMono(getPoly(), layers.melody, start, true),
    )
  }
  if (layers.chords?.length) {
    end = Math.max(end, scheduleChords(layers.chords, start))
  }
  if (layers.bass?.length) {
    end = Math.max(
      end,
      schedulePhrasesMono(getBass(), layers.bass, start, false),
    )
  }
  if (layers.drums?.length) {
    end = Math.max(end, scheduleDrums(layers.drums, start))
  }

  playing = true
  const totalMs = (end - start + 0.25) * 1000
  endTimer = setTimeout(() => {
    playing = false
    endTimer = null
    onEnd?.()
  }, totalMs)
}

/** Play phrases using each phrase's own BPM (melody / bass). */
export async function playPhrases(
  phrases: Phrase[],
  onEnd?: () => void,
  as: 'melody' | 'bass' = 'melody',
): Promise<void> {
  const muteAll = {
    melody: true,
    chords: true,
    bass: true,
    drums: true,
  }
  muteAll[as] = false
  await playLayers(
    as === 'bass' ? { bass: phrases } : { melody: phrases },
    {
      volume: { melody: 0.85, chords: 0, bass: 0.75, drums: 0 },
      mute: muteAll,
      solo: { melody: false, chords: false, bass: false, drums: false },
    },
    onEnd,
  )
}

export async function playPhrase(
  phrase: Phrase,
  onEnd?: () => void,
): Promise<void> {
  await playPhrases([phrase], onEnd)
}

export async function playChordProgression(
  chords: ChordBar[],
  onEnd?: () => void,
): Promise<void> {
  await playLayers({ chords }, {
    volume: { melody: 0, chords: 0.7, bass: 0, drums: 0 },
    mute: { melody: true, chords: false, bass: true, drums: true },
    solo: { melody: false, chords: false, bass: false, drums: false },
  }, onEnd)
}

export async function playDrumPhrase(
  phrase: DrumPhrase,
  onEnd?: () => void,
): Promise<void> {
  await playLayers({ drums: [phrase] }, {
    volume: { melody: 0, chords: 0, bass: 0, drums: 0.8 },
    mute: { melody: true, chords: true, bass: true, drums: false },
    solo: { melody: false, chords: false, bass: false, drums: false },
  }, onEnd)
}

void drumInstrumentMidi

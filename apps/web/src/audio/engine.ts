/**
 * Tone.js playback engine. Loaded lazily via ./player so Tone stays out of the initial bundle.
 */
import * as Tone from 'tone'
import { DURATION_BEATS } from '../core/rhythm'
import {
  expandChordBarPlay,
  resolveChordPlayStyle,
} from '../core/chords/playStyle'
import { drumInstrumentMidi } from '../core/drums/generate'
import type {
  ChordBar,
  ChordPlayStyleId,
  DrumPhrase,
  MixerState,
  LayerKind,
} from '../core/projectTypes'
import type { Phrase } from '../core/types'
import {
  createDefaultTones,
  type ToneId,
  type ToneMap,
} from '../core/tones/presets'
import { createBass, createPoly, type LeadSynth } from './voices'
import { PLAYBACK_START_DELAY_SEC, isPlaying, notifyPlayback } from './playbackState'

let poly: Tone.PolySynth | null = null
let polyTone: ToneId | null = null
let bassSynth: LeadSynth | null = null
let bassTone: ToneId | null = null
let kick: Tone.MembraneSynth | null = null
let snare: Tone.NoiseSynth | null = null
let hat: Tone.MetalSynth | null = null
let endTimer: ReturnType<typeof setTimeout> | null = null
let pumpTimer: ReturnType<typeof setTimeout> | null = null
let playGeneration = 0

/** How far ahead of the speakers notes are handed to the synths. */
const LOOKAHEAD_SEC = 0.8
const PUMP_MS = 200
/**
 * Silence before the first note. Synths are built before this clock starts,
 * so the delay only has to cover handing over the opening slice.
 */
const gains: Partial<Record<LayerKind, Tone.Gain>> = {}
function layerGain(kind: LayerKind): Tone.Gain {
  if (!gains[kind]) {
    gains[kind] = new Tone.Gain(1).toDestination()
  }
  return gains[kind]!
}

function getPoly(tone: ToneId): Tone.PolySynth {
  if (poly && polyTone !== tone) {
    poly.dispose()
    poly = null
  }
  if (!poly) {
    poly = createPoly(tone).connect(layerGain('melody'))
    polyTone = tone
  }
  return poly
}

function getBass(tone: ToneId): LeadSynth {
  if (bassSynth && bassTone !== tone) {
    bassSynth.dispose()
    bassSynth = null
  }
  if (!bassSynth) {
    bassSynth = createBass(tone).connect(layerGain('bass'))
    bassTone = tone
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

let chordPoly: Tone.PolySynth | null = null
let chordTone: ToneId | null = null
function getChordPoly(tone: ToneId): Tone.PolySynth {
  if (chordPoly && chordTone !== tone) {
    chordPoly.dispose()
    chordPoly = null
  }
  if (!chordPoly) {
    chordPoly = createPoly(tone).connect(layerGain('chords'))
    chordTone = tone
  }
  return chordPoly
}

export async function ensureAudio(): Promise<void> {
  await Tone.start()
}

function clearPump(): void {
  if (pumpTimer != null) {
    clearTimeout(pumpTimer)
    pumpTimer = null
  }
}

function haltScheduledAudio(): void {
  playGeneration += 1
  clearPump()
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
  polyTone = null
  chordPoly = null
  chordTone = null
  bassSynth = null
  bassTone = null
  kick = null
  snare = null
  hat = null
}

export async function stopPlayback(): Promise<void> {
  haltScheduledAudio()
  notifyPlayback(false)
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

type MelodyCue = { at: number; freq: number; dur: number }
type ChordCue = { at: number; freqs: number[]; dur: number }
type DrumCue = { at: number; dur: number; velocity?: number }

/**
 * Notes are listed in seconds from the downbeat, then handed to the synths
 * a couple of seconds at a time. Scheduling a whole song at once blocks the
 * main thread long enough that the opening is already in the past, so those
 * notes are dropped.
 */
function collectPhrases(
  phrases: Phrase[],
  usePoly: boolean,
  cues: MelodyCue[],
): number {
  let t = 0
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
        cues.push({
          at: t,
          freq: Tone.Frequency(note.pitch, 'midi').toFrequency(),
          dur: noteGateSec(durSec, sameNext, usePoly),
        })
      }
      t += durSec
    }
  }
  return t
}

function collectChords(
  chords: ChordBar[],
  playStyle: ChordPlayStyleId,
  cues: ChordCue[],
): number {
  let t = 0
  for (const bar of chords) {
    const beatSec = 60 / Math.max(1, bar.bpm)
    const durSec = 4 * beatSec
    const style = resolveChordPlayStyle(playStyle)
    for (const ev of expandChordBarPlay(bar, style)) {
      cues.push({
        at: t + ev.timeBeat * beatSec,
        freqs: ev.pitches.map((pitch) =>
          Tone.Frequency(pitch, 'midi').toFrequency(),
        ),
        dur: Math.max(0.05, ev.durationBeats * beatSec * 0.95),
      })
    }
    t += durSec
  }
  return t
}

function collectDrums(
  phrases: DrumPhrase[],
  kick: DrumCue[],
  snare: DrumCue[],
  hat: DrumCue[],
): number {
  let end = 0
  let t0 = 0
  for (const phrase of phrases) {
    const beatSec = 60 / Math.max(1, phrase.bpm)
    for (const hit of phrase.hits) {
      const at = t0 + hit.beat * beatSec
      const dur = DURATION_BEATS[hit.duration] * beatSec
      if (hit.instrument === 'kick') {
        kick.push({ at, dur: Math.max(0.05, dur) })
      } else if (hit.instrument === 'snare') {
        snare.push({ at, dur: Math.max(0.05, dur) })
      } else {
        hat.push({ at, dur: Math.max(0.03, dur * 0.5), velocity: 0.3 })
      }
      end = Math.max(end, at + dur)
    }
    t0 += phrase.bars * 4 * beatSec
    end = Math.max(end, t0)
  }
  return end
}

function scheduleSlice<T extends { at: number }>(
  cues: T[],
  cursor: { i: number },
  start: number,
  play: (cue: T, time: number) => void,
): void {
  const now = Tone.now()
  const until = now + LOOKAHEAD_SEC
  while (cursor.i < cues.length) {
    const cue = cues[cursor.i]!
    const time = start + cue.at
    if (time > until) break
    cursor.i += 1
    // Re-read the clock: a slow handoff must drop late notes, not sound them all at once.
    if (time < Tone.now() - 0.02) continue
    play(cue, time)
  }
}

export type LayerPlayback = {
  melody?: Phrase[]
  chords?: ChordBar[]
  bass?: Phrase[]
  drums?: DrumPhrase[]
}

export type PlayOptions = {
  chordPlayStyle?: ChordPlayStyleId
  tones?: ToneMap
}

export async function playLayers(
  layers: LayerPlayback,
  mixer: MixerState,
  onEnd?: () => void,
  options?: PlayOptions,
): Promise<number> {
  // Flip UI to "停止" immediately (before any await)
  notifyPlayback(true)

  try {
    await ensureAudio()
    haltScheduledAudio()
    const generation = playGeneration
    applyMixer(mixer)

    const chordStyle = options?.chordPlayStyle ?? 'block'
    const tones = options?.tones ?? createDefaultTones()
    const melodyCues: MelodyCue[] = []
    const bassCues: MelodyCue[] = []
    const chordCues: ChordCue[] = []
    const kickCues: DrumCue[] = []
    const snareCues: DrumCue[] = []
    const hatCues: DrumCue[] = []
    let span = 0

    if (layers.melody?.length) {
      span = Math.max(span, collectPhrases(layers.melody, true, melodyCues))
    }
    if (layers.chords?.length) {
      span = Math.max(span, collectChords(layers.chords, chordStyle, chordCues))
    }
    if (layers.bass?.length) {
      span = Math.max(span, collectPhrases(layers.bass, false, bassCues))
    }
    if (layers.drums?.length) {
      span = Math.max(
        span,
        collectDrums(layers.drums, kickCues, snareCues, hatCues),
      )
    }

    const byAt = (a: { at: number }, b: { at: number }) => a.at - b.at
    melodyCues.sort(byAt)
    bassCues.sort(byAt)
    chordCues.sort(byAt)
    kickCues.sort(byAt)
    snareCues.sort(byAt)
    hatCues.sort(byAt)

    if (melodyCues.length) getPoly(tones.melody)
    if (chordCues.length) getChordPoly(tones.chords)
    if (bassCues.length) getBass(tones.bass)
    if (kickCues.length) getKick()
    if (snareCues.length) getSnare()
    if (hatCues.length) getHat()

    const start = Tone.now() + PLAYBACK_START_DELAY_SEC
    const melodyCursor = { i: 0 }
    const bassCursor = { i: 0 }
    const chordCursor = { i: 0 }
    const kickCursor = { i: 0 }
    const snareCursor = { i: 0 }
    const hatCursor = { i: 0 }

    const pump = () => {
      if (generation !== playGeneration) return
      scheduleSlice(melodyCues, melodyCursor, start, (cue, time) => {
        getPoly(tones.melody).triggerAttackRelease(cue.freq, cue.dur, time)
      })
      scheduleSlice(chordCues, chordCursor, start, (cue, time) => {
        getChordPoly(tones.chords).triggerAttackRelease(cue.freqs, cue.dur, time)
      })
      scheduleSlice(bassCues, bassCursor, start, (cue, time) => {
        ;(getBass(tones.bass) as Tone.Synth).triggerAttackRelease(
          cue.freq,
          cue.dur,
          time,
        )
      })
      scheduleSlice(kickCues, kickCursor, start, (cue, time) => {
        getKick().triggerAttackRelease('C1', cue.dur, time)
      })
      scheduleSlice(snareCues, snareCursor, start, (cue, time) => {
        getSnare().triggerAttackRelease(cue.dur, time)
      })
      scheduleSlice(hatCues, hatCursor, start, (cue, time) => {
        getHat().triggerAttackRelease(cue.dur, time, cue.velocity ?? 0.3)
      })
      const pending =
        melodyCursor.i < melodyCues.length ||
        chordCursor.i < chordCues.length ||
        bassCursor.i < bassCues.length ||
        kickCursor.i < kickCues.length ||
        snareCursor.i < snareCues.length ||
        hatCursor.i < hatCues.length
      if (pending && generation === playGeneration) {
        pumpTimer = setTimeout(pump, PUMP_MS)
      }
    }
    pump()

    if (generation !== playGeneration) return 0
    if (!isPlaying()) notifyPlayback(true)

    const totalMs = Math.max(100, (span + 0.35) * 1000)
    endTimer = setTimeout(() => {
      if (generation !== playGeneration) return
      endTimer = null
      clearPump()
      notifyPlayback(false)
      onEnd?.()
    }, totalMs)
    return Math.max(0, (start - Tone.now()) * 1000)
  } catch (err) {
    notifyPlayback(false)
    throw err
  }
}

/** Play phrases using each phrase's own BPM (melody / bass). */
export async function playPhrases(
  phrases: Phrase[],
  onEnd?: () => void,
  as: 'melody' | 'bass' = 'melody',
  tones?: ToneMap,
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
    { tones },
  )
}

export async function playPhrase(
  phrase: Phrase,
  onEnd?: () => void,
  tones?: ToneMap,
): Promise<void> {
  await playPhrases([phrase], onEnd, 'melody', tones)
}

export async function playChordProgression(
  chords: ChordBar[],
  onEnd?: () => void,
  playStyle: ChordPlayStyleId = 'block',
  tones?: ToneMap,
): Promise<void> {
  await playLayers(
    { chords },
    {
      volume: { melody: 0, chords: 0.7, bass: 0, drums: 0 },
      mute: { melody: true, chords: false, bass: true, drums: true },
      solo: { melody: false, chords: false, bass: false, drums: false },
    },
    onEnd,
    { chordPlayStyle: playStyle, tones },
  )
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

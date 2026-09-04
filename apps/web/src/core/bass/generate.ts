import { getScaleIntervals } from '../scale'
import type { ChordBar } from '../projectTypes'
import type { Note, Phrase, RhythmId, ScaleType } from '../types'
import { resolveRhythmSlots } from '../rhythm'
import { chordRootMidiFromBar, uid } from '../chords/theory'

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

function takeChordBars(chords: ChordBar[], barCount: number): ChordBar[] {
  if (chords.length === 0 || barCount <= 0) return []
  const out: ChordBar[] = []
  for (let i = 0; i < barCount; i++) {
    out.push(chords[i % chords.length]!)
  }
  return out
}

/** Bass from chord stage: root / fifth / simple walk */
export function generateBassFollowChords(
  chords: ChordBar[],
  rhythmId: RhythmId,
  octave: number,
  barCount: number,
): Phrase | null {
  const use = takeChordBars(chords, barCount)
  if (use.length === 0) return null
  const bpm = use[0]!.bpm
  const keyRoot = use[0]!.keyRoot
  const scale = use[0]!.scale
  const notes: Note[] = []

  for (const bar of use) {
    const slots = resolveRhythmSlots(rhythmId, 0, 1)
    const root = chordRootMidiFromBar(bar, octave)
    const fifth = root + 7
    const approach = root - 2
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]!
      if (slot.rest) {
        notes.push({ pitch: root, duration: slot.duration, rest: true })
        continue
      }
      let pitch = root
      if (slots.length >= 4) {
        if (i === 1) pitch = pick([root, fifth])
        else if (i === 2) pitch = pick([root, fifth, approach])
        else if (i === 3) pitch = pick([root, approach])
      } else if (i > 0) {
        pitch = pick([root, fifth])
      }
      notes.push({ pitch, duration: slot.duration })
    }
  }

  return {
    id: uid('bass'),
    notes,
    bars: use.length,
    bpm,
    keyRoot,
    scale,
  }
}

/** Random bass in low register (scale tones) */
export function generateBassRandom(
  barCount: number,
  keyRoot: number,
  scale: ScaleType,
  bpm: number,
  rhythmId: RhythmId,
  octave: number,
): Phrase {
  const intervals = getScaleIntervals(scale)
  const slots = resolveRhythmSlots(rhythmId, 0, barCount)
  const notes: Note[] = slots.map((slot) => {
    if (slot.rest) {
      return { pitch: 36, duration: slot.duration, rest: true }
    }
    const iv = pick(intervals)
    const pitch = (octave + 1) * 12 + keyRoot + iv
    return { pitch, duration: slot.duration }
  })
  return {
    id: uid('bass'),
    notes,
    bars: barCount,
    bpm,
    keyRoot,
    scale,
  }
}

export function generateBassCandidates(
  mode: 'follow' | 'random',
  count: number,
  chords: ChordBar[],
  barCount: number,
  keyRoot: number,
  scale: ScaleType,
  bpm: number,
  rhythmId: RhythmId,
  octave: number,
): Phrase[] {
  const out: Phrase[] = []
  for (let i = 0; i < count; i++) {
    if (mode === 'follow') {
      const p = generateBassFollowChords(chords, rhythmId, octave, barCount)
      if (p) out.push(p)
    } else {
      out.push(
        generateBassRandom(
          barCount,
          keyRoot,
          scale,
          bpm,
          rhythmId,
          octave,
        ),
      )
    }
  }
  return out
}

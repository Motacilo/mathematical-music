/**
 * Keep an auto-generated melody from fighting the chords under it.
 *
 * The melody generator only knows the key, so on its own it often lands on
 * notes that grate against the chord of that bar (for example F over a C
 * chord on the downbeat). Each melody bar is checked against the chord that
 * plays in the same bar:
 *
 * - chord tones are always kept
 * - notes outside the key are moved to a chord tone
 * - exposed notes (the downbeat, a quarter or longer on beat 3, anything a
 *   dotted quarter or longer) that are not chord tones move to a chord tone
 * - short notes on weak beats may stay as passing / neighbour tones; one that
 *   sits a semitone from a chord tone (a minor-2nd / minor-9th rub) moves to
 *   the nearest in-key note that does not rub
 * - the very last sounding note of the block always ends on a chord tone
 *
 * Moves go to the nearest allowed note, keeping the line smooth with the
 * previous note but avoiding turning it into a repeated note.
 */
import { chordPitches } from '../chords/theory'
import { isPitchInScale } from '../distributionWeights'
import type { ChordBar } from '../projectTypes'
import { DURATION_BEATS } from '../rhythm'
import type { Phrase, ScaleType } from '../types'

const EPS = 1e-6

function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12
}

export function chordPitchClasses(chord: ChordBar): number[] {
  return [...new Set(chordPitches(chord).map(pitchClass))]
}

/**
 * Notes the ear hangs on: the downbeat, a quarter or longer on beat 3, and
 * anything a dotted quarter or longer. These must be chord tones; others may
 * pass through the key.
 */
export function isExposedNote(onset: number, length: number): boolean {
  const onBeat = (b: number) => Math.abs(onset - b) < EPS
  if (onBeat(0)) return true
  if (onBeat(2) && length >= 1 - EPS) return true
  return length >= 1.5 - EPS
}

/** True when the note is a semitone above or below some chord tone. */
export function rubsAgainst(pc: number, chordPcs: number[]): boolean {
  return chordPcs.some((c) => {
    const d = (pc - c + 12) % 12
    return d === 1 || d === 11
  })
}

/** Pitch class allowed under this chord for the given role of the note. */
type Allowed = (pc: number) => boolean

/**
 * Closest allowed pitch to `pitch`. Leans toward a smooth line with the
 * previous note, but avoids simply repeating it, so fixing a clash does not
 * flatten the melody into one held note.
 */
function closestAllowed(
  pitch: number,
  allowed: Allowed,
  previous: number | undefined,
  wasRepeat: boolean,
): number {
  let best = pitch
  let bestScore = Number.POSITIVE_INFINITY
  for (let cand = pitch - 7; cand <= pitch + 7; cand++) {
    if (cand < 0 || cand > 127) continue
    if (!allowed(pitchClass(cand))) continue
    let score = Math.abs(cand - pitch)
    if (previous != null) {
      score += 0.25 * Math.abs(cand - previous)
      if (cand === previous && !wasRepeat) score += 3
    }
    if (score < bestScore - EPS) {
      best = cand
      bestScore = score
    }
  }
  return best
}

/** Nearest pitch (any octave) whose pitch class is a tone of the chord. */
export function nearestChordTone(
  pitch: number,
  chord: ChordBar,
  previous?: number,
): number {
  const pcs = chordPitchClasses(chord)
  return closestAllowed(pitch, (pc) => pcs.includes(pc), previous, pitch === previous)
}

export function fitMelodyToChords(
  melody: Phrase[],
  chords: ChordBar[],
  keyRoot: number,
  scale: ScaleType,
): Phrase[] {
  let previous: number | undefined
  const fitted = melody.map((phrase, barIndex) => {
    const chord = chords[barIndex]
    if (!chord) {
      for (const n of phrase.notes) if (!n.rest) previous = n.pitch
      return phrase
    }
    const pcs = chordPitchClasses(chord)
    let beat = 0
    const notes = phrase.notes.map((note) => {
      const onset = beat
      const length = DURATION_BEATS[note.duration] ?? 0
      beat += length
      if (note.rest) return note

      const pc = pitchClass(note.pitch)
      const wasRepeat = note.pitch === previous
      const inKey = (p: number) => isPitchInScale(p, keyRoot, scale)
      const isChordTone = (p: number) => pcs.includes(p)
      let pitch = note.pitch
      if (!isChordTone(pc)) {
        const exposed = isExposedNote(onset, length)
        if (exposed || !inKey(note.pitch)) {
          // Strong / long / out-of-key: land on a chord tone.
          pitch = closestAllowed(note.pitch, isChordTone, previous, wasRepeat)
        } else if (rubsAgainst(pc, pcs)) {
          // Short weak-beat note: keep it moving as a passing tone, just not
          // one that sits a semitone from the chord.
          pitch = closestAllowed(
            note.pitch,
            (c) => isChordTone(c) || (inKey(c) && !rubsAgainst(c, pcs)),
            previous,
            wasRepeat,
          )
        }
      }
      previous = pitch
      return pitch === note.pitch ? note : { ...note, pitch }
    })
    return { ...phrase, notes }
  })

  // End the block on a chord tone.
  for (let b = fitted.length - 1; b >= 0; b--) {
    const chord = chords[b]
    const notes = fitted[b]!.notes
    const i = notes.findLastIndex((n) => !n.rest)
    if (i < 0) continue
    if (chord) {
      const last = notes[i]!
      const pitch = nearestChordTone(last.pitch, chord)
      if (pitch !== last.pitch) {
        const copy = notes.slice()
        copy[i] = { ...last, pitch }
        fitted[b] = { ...fitted[b]!, notes: copy }
      }
    }
    break
  }
  return fitted
}

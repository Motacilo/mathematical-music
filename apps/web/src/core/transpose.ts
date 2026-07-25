import type { Note, Phrase } from './types'

/** Shortest signed semitone distance between pitch-class roots (0–11). */
export function keySemitoneDelta(fromRoot: number, toRoot: number): number {
  let d = (((toRoot - fromRoot) % 12) + 12) % 12
  if (d > 6) d -= 12
  return d
}

function transposeNote(note: Note, semitones: number): Note {
  if (note.rest) return { ...note }
  return {
    ...note,
    pitch: Math.max(0, Math.min(127, note.pitch + semitones)),
  }
}

export function transposePhrase(
  phrase: Phrase,
  semitones: number,
  keyRoot: number,
  bpm?: number,
): Phrase {
  return {
    ...phrase,
    keyRoot,
    bpm: bpm ?? phrase.bpm,
    notes: phrase.notes.map((n) => transposeNote(n, semitones)),
  }
}

export function transposePhrases(
  phrases: Phrase[],
  fromKey: number,
  toKey: number,
  bpm?: number,
): Phrase[] {
  const delta = keySemitoneDelta(fromKey, toKey)
  if (delta === 0 && bpm == null) {
    return phrases.map((p) => ({ ...p, keyRoot: toKey }))
  }
  return phrases.map((p) => transposePhrase(p, delta, toKey, bpm))
}

export function applyBpmToPhrases(phrases: Phrase[], bpm: number): Phrase[] {
  return phrases.map((p) => ({ ...p, bpm }))
}

import { BAR_BEATS, DURATION_BEATS } from './rhythm'
import type { Note, Phrase } from './types'

function uid(): string {
  return `ph_${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Split a multi-bar phrase into one Phrase per bar (4/4 = 4 beats).
 * Notes that would cross a bar line start a new bar.
 */
export function splitPhraseIntoBars(phrase: Phrase): Phrase[] {
  if (phrase.notes.length === 0) {
    return [{ ...phrase, id: uid(), bars: 1, notes: [] }]
  }

  const groups: Note[][] = []
  let current: Note[] = []
  let beats = 0

  for (const note of phrase.notes) {
    const dur = DURATION_BEATS[note.duration]
    if (current.length > 0 && beats + dur > BAR_BEATS + 1e-9) {
      groups.push(current)
      current = []
      beats = 0
    }
    current.push({ ...note })
    beats += dur
    if (beats >= BAR_BEATS - 1e-9) {
      groups.push(current)
      current = []
      beats = 0
    }
  }
  if (current.length > 0) {
    groups.push(current)
  }

  return groups.map((notes) => ({
    id: uid(),
    notes,
    bars: 1,
    bpm: phrase.bpm,
    keyRoot: phrase.keyRoot,
    scale: phrase.scale,
  }))
}

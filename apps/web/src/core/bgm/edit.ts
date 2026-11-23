import { approxDegreeFromOffset, normalizeChordBar } from '../chords/theory'
import { rootDef, type ChordRootId } from '../chords/roots'
import { fitMelodyToChords } from '../harmony/fitMelody'
import type { ChordBar, ChordQuality, ConcreteChordPlayStyle } from '../projectTypes'
import { DURATION_BEATS } from '../rhythm'
import type { Duration, Note, Phrase } from '../types'
import type { BgmSong } from './generate'

/** Layers whose notes can be edited one by one. */
export type NoteLayer = 'melody' | 'bass'

export type Selection =
  | { layer: NoteLayer; bar: number; index: number }
  | { layer: 'chords'; bar: number }
  | null

export const DURATION_LABELS: Record<Duration, string> = {
  '16n': '16分',
  '8n': '8分',
  '8n.': '付点8分',
  '4n': '4分',
  '4n.': '付点4分',
  '2n': '2分',
  '1n': '全音符',
}

const MIN_PITCH = 21
const MAX_PITCH = 108

const SPLIT: Partial<Record<Duration, [Duration, Duration]>> = {
  '1n': ['2n', '2n'],
  '2n': ['4n', '4n'],
  '4n.': ['4n', '8n'],
  '4n': ['8n', '8n'],
  '8n.': ['8n', '16n'],
  '8n': ['16n', '16n'],
}

function durationOfBeats(beats: number): Duration | null {
  for (const key of Object.keys(DURATION_BEATS) as Duration[]) {
    if (Math.abs(DURATION_BEATS[key] - beats) < 1e-9) return key
  }
  return null
}

export function notePhrase(song: BgmSong, layer: NoteLayer, bar: number): Phrase | undefined {
  return song[layer][bar]
}

export function selectedNote(song: BgmSong, sel: Selection): Note | null {
  if (!sel || sel.layer === 'chords') return null
  return notePhrase(song, sel.layer, sel.bar)?.notes[sel.index] ?? null
}

function withPhrase(
  song: BgmSong,
  layer: NoteLayer,
  bar: number,
  notes: Note[],
): BgmSong {
  const phrase = song[layer][bar]
  if (!phrase) return song
  const next = song[layer].slice()
  next[bar] = { ...phrase, notes }
  return { ...song, [layer]: next }
}

/** Move a sounding note by semitones. Rests stay as they are. */
export function shiftPitch(song: BgmSong, sel: Selection, semitones: number): BgmSong {
  if (!sel || sel.layer === 'chords') return song
  const phrase = notePhrase(song, sel.layer, sel.bar)
  const note = phrase?.notes[sel.index]
  if (!phrase || !note || note.rest) return song
  const pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, note.pitch + semitones))
  if (pitch === note.pitch) return song
  const notes = phrase.notes.slice()
  notes[sel.index] = { ...note, pitch }
  return withPhrase(song, sel.layer, sel.bar, notes)
}

/** Sounding pitch just before the selection, or `fallback`. Used when a rest becomes a note. */
export function pitchBefore(song: BgmSong, sel: Selection, fallback: number): number {
  if (!sel || sel.layer === 'chords') return fallback
  for (let bar = sel.bar; bar >= 0; bar--) {
    const notes = song[sel.layer][bar]?.notes ?? []
    const from = bar === sel.bar ? sel.index - 1 : notes.length - 1
    for (let i = from; i >= 0; i--) if (!notes[i]!.rest) return notes[i]!.pitch
  }
  return fallback
}

export function toggleRest(song: BgmSong, sel: Selection, fallbackPitch: number): BgmSong {
  if (!sel || sel.layer === 'chords') return song
  const phrase = notePhrase(song, sel.layer, sel.bar)
  const note = phrase?.notes[sel.index]
  if (!phrase || !note) return song
  const notes = phrase.notes.slice()
  if (note.rest) {
    const pitch = pitchBefore(song, sel, fallbackPitch)
    notes[sel.index] = { pitch, duration: note.duration }
  } else {
    notes[sel.index] = { ...note, rest: true }
  }
  return withPhrase(song, sel.layer, sel.bar, notes)
}

export function canSplit(song: BgmSong, sel: Selection): boolean {
  const note = selectedNote(song, sel)
  return note != null && SPLIT[note.duration] != null
}

/** Cut a note into two shorter ones. The bar keeps its length. */
export function splitNote(song: BgmSong, sel: Selection): BgmSong {
  if (!sel || sel.layer === 'chords') return song
  const phrase = notePhrase(song, sel.layer, sel.bar)
  const note = phrase?.notes[sel.index]
  const parts = note ? SPLIT[note.duration] : undefined
  if (!phrase || !note || !parts) return song
  const notes = phrase.notes.slice()
  notes.splice(sel.index, 1, { ...note, duration: parts[0] }, { ...note, duration: parts[1] })
  return withPhrase(song, sel.layer, sel.bar, notes)
}

function mergedDuration(song: BgmSong, sel: Selection): Duration | null {
  if (!sel || sel.layer === 'chords') return null
  const notes = notePhrase(song, sel.layer, sel.bar)?.notes
  const a = notes?.[sel.index]
  const b = notes?.[sel.index + 1]
  if (!a || !b) return null
  // A rest cannot swallow a sounding note.
  if (a.rest && !b.rest) return null
  return durationOfBeats(DURATION_BEATS[a.duration] + DURATION_BEATS[b.duration])
}

export function canMerge(song: BgmSong, sel: Selection): boolean {
  return mergedDuration(song, sel) != null
}

/** Join with the next note in the same bar (a following rest is absorbed). */
export function mergeWithNext(song: BgmSong, sel: Selection): BgmSong {
  const duration = mergedDuration(song, sel)
  if (!duration || !sel || sel.layer === 'chords') return song
  const phrase = notePhrase(song, sel.layer, sel.bar)!
  const notes = phrase.notes.slice()
  notes.splice(sel.index, 2, { ...notes[sel.index]!, duration })
  return withPhrase(song, sel.layer, sel.bar, notes)
}

/** Next (dir 1) or previous (dir -1) note in the lane, crossing bar lines. */
export function neighbour(song: BgmSong, sel: Selection, dir: 1 | -1): Selection {
  if (!sel) return sel
  if (sel.layer === 'chords') {
    const bar = sel.bar + dir
    return bar >= 0 && bar < song.chords.length ? { layer: 'chords', bar } : sel
  }
  const lane = song[sel.layer]
  let bar = sel.bar
  let index = sel.index + dir
  while (bar >= 0 && bar < lane.length) {
    const count = lane[bar]!.notes.length
    if (index >= 0 && index < count) return { layer: sel.layer, bar, index }
    bar += dir
    index = dir === 1 ? 0 : (lane[bar]?.notes.length ?? 0) - 1
  }
  return sel
}

export type ChordPatch = {
  rootId?: ChordRootId
  quality?: ChordQuality
  playStyle?: ConcreteChordPlayStyle
}

export function setChord(song: BgmSong, bar: number, patch: ChordPatch): BgmSong {
  const old = song.chords[bar]
  if (!old) return song
  let next: ChordBar = { ...old }
  if (patch.rootId) {
    const rootOffset = rootDef(patch.rootId).offset
    next = {
      ...next,
      rootId: patch.rootId,
      rootOffset,
      degree: approxDegreeFromOffset(rootOffset, old.scale),
    }
  }
  if (patch.quality) next.quality = patch.quality
  if (patch.playStyle) next.playStyle = patch.playStyle
  const chords = song.chords.slice()
  chords[bar] = normalizeChordBar(next)
  return { ...song, chords }
}

/** Pull this bar's melody onto its chord (after the chord was changed). */
export function fitBarToChord(
  song: BgmSong,
  bar: number,
  keyRoot: number,
  scale: 'major' | 'minor',
): BgmSong {
  const phrase = song.melody[bar]
  const chord = song.chords[bar]
  if (!phrase || !chord) return song
  const [fitted] = fitMelodyToChords([phrase], [chord], keyRoot, scale)
  if (!fitted) return song
  const melody = song.melody.slice()
  melody[bar] = fitted
  return { ...song, melody }
}

import { buildDegreeChord } from '../autofill/generate'
import { randomSongFeel } from '../autofill/melody'
import { chordRootMidiFromBar, uid } from '../chords/theory'
import { nearestChordTone, fitMelodyToChords } from '../harmony/fitMelody'
import type { MoodPreset } from '../mood/presets'
import type { ChordBar, ConcreteChordPlayStyle, DrumPhrase } from '../projectTypes'
import {
  generateSectionCandidates,
  type SectionCandidate,
} from '../sections/generate'
import type { SectionRole } from '../sections/roles'
import type { Note, Phrase, ScaleType } from '../types'
import type { BgmBlock, BgmEnding } from './plan'

export type BgmSongSection = {
  label: string
  /** Index of the pattern (for colour); -1 for the ringing bar */
  colorIndex: number
  startBar: number
  bars: number
}

export type BgmSong = {
  /** Every layer has exactly this many bars (the extra ringing bar included). */
  bars: number
  /** Bars the arrangement asked for, without the ringing bar. */
  planBars: number
  /** Where each pattern sits, for labels and colour in the views */
  sections: BgmSongSection[]
  melody: Phrase[]
  chords: ChordBar[]
  bass: Phrase[]
  drums: DrumPhrase[]
}

export type BgmOptions = {
  blocks: readonly BgmBlock[]
  /** Block ids in playing order */
  arrangement: readonly string[]
  keyRoot: number
  scale: ScaleType
  bpm: number
  mood: MoodPreset | null
  ending: BgmEnding
}

/**
 * Which section profile writes each block. A is the theme, the last is the lift,
 * so a two-pattern tune is "theme, then peak" and more patterns add colour between.
 */
const ROLE_PLANS: readonly (readonly SectionRole[])[] = [
  ['a'],
  ['a', 'chorus'],
  ['a', 'b', 'chorus'],
  ['a', 'b', 'chorus', 'c'],
  ['a', 'b', 'chorus', 'c', 'a'],
  ['a', 'b', 'chorus', 'c', 'a', 'b'],
]

export function roleForBlock(index: number, count: number): SectionRole {
  const plan = ROLE_PLANS[Math.min(count, ROLE_PLANS.length) - 1] ?? ROLE_PLANS[0]!
  return plan[index] ?? 'a'
}

function cloneNotes(notes: Note[]): Note[] {
  return notes.map((n) => ({ ...n }))
}

function clonePhrases(phrases: Phrase[], prefix: string): Phrase[] {
  return phrases.map((p) => ({ ...p, id: uid(prefix), notes: cloneNotes(p.notes) }))
}

function cloneDrums(phrases: DrumPhrase[]): DrumPhrase[] {
  return phrases.map((p) => ({ ...p, id: uid('drm'), hits: p.hits.map((h) => ({ ...h })) }))
}

function cloneChords(chords: ChordBar[]): ChordBar[] {
  return chords.map((c) => ({ ...c, id: uid('ch') }))
}

function firstSoundingPitch(phrases: Phrase[]): number | undefined {
  for (const phrase of phrases) {
    for (const note of phrase.notes) if (!note.rest) return note.pitch
  }
  return undefined
}

function lastSoundingIndex(notes: Note[]): number {
  for (let i = notes.length - 1; i >= 0; i--) if (!notes[i]!.rest) return i
  return -1
}

/** Move a bass bar so its notes follow a new chord root, keeping the rhythm and register. */
function retargetBassBar(bar: Phrase, from: ChordBar, to: ChordBar): void {
  const raw = chordRootMidiFromBar(to, 3) - chordRootMidiFromBar(from, 3)
  const delta = ((((raw % 12) + 18) % 12) - 6)
  for (const note of bar.notes) if (!note.rest) note.pitch += delta
}

function replaceLastChord(
  song: { melody: Phrase[]; chords: ChordBar[]; bass: Phrase[] },
  chord: ChordBar,
  keyRoot: number,
  scale: ScaleType,
): void {
  const last = song.chords.length - 1
  const old = song.chords[last]!
  const next: ChordBar = { ...chord, id: uid('ch'), playStyle: old.playStyle }
  song.chords[last] = next
  const bassBar = song.bass[last]
  if (bassBar) retargetBassBar(bassBar, old, next)
  const melodyBar = song.melody[last]
  if (melodyBar) {
    const [fitted] = fitMelodyToChords([melodyBar], [next], keyRoot, scale)
    if (fitted) song.melody[last] = fitted
  }
}

/** Last bar leans on the dominant and its last note sits next to the song's first note. */
function shapeLoopEnd(
  song: { melody: Phrase[]; chords: ChordBar[]; bass: Phrase[] },
  options: BgmOptions,
): void {
  const dominant = buildDegreeChord(5, options.keyRoot, options.scale, options.bpm)
  if (dominant) replaceLastChord(song, dominant, options.keyRoot, options.scale)
  const last = song.melody.length - 1
  const bar = song.melody[last]
  const chord = song.chords[last]
  const target = firstSoundingPitch(song.melody)
  if (!bar || !chord || target == null) return
  const i = lastSoundingIndex(bar.notes)
  if (i < 0) return
  const pitch = nearestChordTone(target, chord, bar.notes[i]!.pitch)
  bar.notes[i] = { ...bar.notes[i]!, pitch }
}

function restNotes(count: number): Note[] {
  return Array.from({ length: count }, () => ({
    pitch: 36,
    duration: '4n' as const,
    rest: true,
  }))
}

/**
 * Close on the tonic, then add one bar that rings for half a bar and rests.
 * Melody, bass and chord hold the final sound; the drums only mark the downbeat.
 */
function addRingingBar(
  song: { melody: Phrase[]; chords: ChordBar[]; bass: Phrase[]; drums: DrumPhrase[] },
  options: BgmOptions,
): void {
  const tonic = buildDegreeChord(1, options.keyRoot, options.scale, options.bpm)
  if (tonic) replaceLastChord(song, tonic, options.keyRoot, options.scale)
  const chord = song.chords[song.chords.length - 1]!
  const ringChord: ChordBar = {
    ...chord,
    id: uid('ch'),
    sustain: true,
    holdBeats: 2,
  }
  const proto = song.melody[song.melody.length - 1]!
  const lastMelodyBar = song.melody[song.melody.length - 1]!
  // The held melody note is the key's tonic, in the octave nearest the last note.
  const lastPitch =
    lastMelodyBar.notes[lastSoundingIndex(lastMelodyBar.notes)]?.pitch ?? 60 + options.keyRoot
  let held = 60 + options.keyRoot
  while (held - lastPitch > 6) held -= 12
  while (lastPitch - held > 6) held += 12
  // The bass bar may end on a passing tone; the held note is the chord root.
  const rootPitch = chordRootMidiFromBar(chord, 3)
  const ringBar = (pitch: number): Phrase => ({
    id: uid('bar'),
    bars: 1,
    bpm: proto.bpm,
    keyRoot: proto.keyRoot,
    scale: proto.scale,
    notes: [{ pitch, duration: '2n' }, ...restNotes(2)],
  })
  song.melody.push(ringBar(held))
  song.bass.push(ringBar(rootPitch))
  song.chords.push(ringChord)
  song.drums.push({
    id: uid('drm'),
    bars: 1,
    bpm: options.bpm,
    hits: [{ instrument: 'kick', beat: 0, duration: '8n' }],
  })
}

/**
 * One whole short tune: each pattern is written once, then placed in the chosen
 * order. All patterns share one melodic character and one chord play style per role.
 */
export function generateBgm(options: BgmOptions): BgmSong {
  const { blocks, arrangement } = options
  const feel = randomSongFeel()
  const chordStyles = new Map<SectionRole, ConcreteChordPlayStyle>()
  const made = new Map<string, SectionCandidate>()
  blocks.forEach((block, index) => {
    const role = roleForBlock(index, blocks.length)
    const [candidate] = generateSectionCandidates(
      role,
      block.bars,
      options.keyRoot,
      options.scale,
      options.bpm,
      1,
      options.mood,
      feel,
      chordStyles,
      1,
    )
    made.set(block.id, candidate!)
  })

  const song = {
    melody: [] as Phrase[],
    chords: [] as ChordBar[],
    bass: [] as Phrase[],
    drums: [] as DrumPhrase[],
  }
  let planBars = 0
  const sections: BgmSongSection[] = []
  for (const id of arrangement) {
    const part = made.get(id)
    if (!part) continue
    const colorIndex = blocks.findIndex((b) => b.id === id)
    sections.push({
      label: blocks[colorIndex]?.label ?? '',
      colorIndex,
      startBar: planBars,
      bars: part.bars,
    })
    song.melody.push(...clonePhrases(part.melody, 'mel'))
    song.chords.push(...cloneChords(part.chords))
    song.bass.push(...clonePhrases(part.bass, 'bass'))
    song.drums.push(...cloneDrums(part.drums))
    planBars += part.bars
  }

  if (planBars > 0) {
    if (options.ending === 'loop') shapeLoopEnd(song, options)
    if (options.ending === 'hold') {
      addRingingBar(song, options)
      sections.push({ label: '余韻', colorIndex: -1, startBar: planBars, bars: 1 })
    }
  }
  return {
    bars: planBars + (options.ending === 'hold' && planBars > 0 ? 1 : 0),
    planBars,
    sections,
    ...song,
  }
}

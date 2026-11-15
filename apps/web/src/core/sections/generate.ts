import { generateAutofillSong, type AutofillOptions } from '../autofill/generate'
import { randomSongFeel, type SongFeel } from '../autofill/melody'
import { chordRootMidiFromBar, uid } from '../chords/theory'
import { nearestChordTone } from '../harmony/fitMelody'
import { ARPEGGIO_STYLES, CONCRETE_STYLES } from '../chords/playStyle'
import type { ConcreteChordPlayStyle } from '../projectTypes'
import type { MoodPreset } from '../mood/presets'
import type { ChordBar, DrumPhrase } from '../projectTypes'
import type { DrumStyleId } from '../drums/generate'
import type { Phrase, ScaleType } from '../types'
import {
  FULL_SONG_ROLES,
  SECTION_CANDIDATE_COUNT,
  sectionRoleMeta,
  type SectionRole,
} from './roles'

export type SectionCandidate = {
  id: string
  role: SectionRole
  bars: number
  melody: Phrase[]
  chords: ChordBar[]
  bass: Phrase[]
  drums: DrumPhrase[]
}

const PROFILES: Record<
  'intro' | 'a' | 'b' | 'chorus' | 'c',
  AutofillOptions
> = {
  intro: {
    minBars: 2,
    melodyDensity: -1,
    restChoices: [25, 35, 40],
    bassRhythms: ['quarters'],
    drumStyles: ['ballad', 'half_time'],
    arrangeDrums: false,
    drumDensity: 12,
    centerShift: 0,
    chordStart: 1,
    chordEnd: 1,
    holdPairs: true,
    skipCadence: true,
  },
  a: {
    minBars: 2,
    melodyDensity: -0.1,
    repeatPhrases: true,
    restChoices: [8, 10, 15],
    bassRhythms: ['quarters', 'eighths'],
    drumStyles: ['eight_beat', 'eight_beat', 'rock'],
    arrangeDrums: false,
    drumDensity: 20,
    chordStart: 1,
  },
  b: {
    minBars: 2,
    melodyDensity: 0.3,
    repeatPhrases: true,
    restChoices: [0, 5, 8],
    bassRhythms: ['eighths'],
    drumStyles: ['eight_beat', 'sixteen_beat'],
    arrangeDrums: true,
    drumDensity: 42,
    centerShift: 2,
    chordStart: 4,
    chordEnd: 5,
    skipCadence: true,
  },
  chorus: {
    minBars: 2,
    melodyDensity: 0.7,
    repeatPhrases: true,
    restChoices: [0, 0, 5],
    bassRhythms: ['eighths', 'quarters'],
    drumStyles: ['four_on_floor', 'eight_beat', 'eight_beat'],
    arrangeDrums: true,
    drumDensity: 36,
    centerShift: 5,
    chordStart: 1,
    chordEnd: 1,
  },
  c: {
    minBars: 2,
    melodyDensity: -0.5,
    restChoices: [15, 20, 25],
    bassRhythms: ['quarters'],
    drumStyles: ['half_time', 'ballad'],
    arrangeDrums: false,
    drumDensity: 16,
    centerShift: -2,
    chordStart: 6,
    chordEnd: 5,
    skipCadence: true,
  },
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

/**
 * 間奏 and 後奏 borrow either the intro or the chorus, then thin it out.
 * Each call rolls again, so the three candidates are not copies of one shape.
 */
function resolveProfile(role: SectionRole): { options: AutofillOptions; quiet: boolean } {
  if (role !== 'interlude' && role !== 'outro') {
    return { options: PROFILES[role], quiet: role === 'intro' || role === 'c' }
  }
  const fromChorus = Math.random() < 0.5
  const base = fromChorus ? PROFILES.chorus : PROFILES.intro
  if (role === 'interlude') {
    return {
      quiet: !fromChorus,
      options: {
        ...base,
        minBars: 2,
        restChoices: fromChorus ? [8, 12, 18] : [15, 22, 30],
        melodyDensity: fromChorus ? 0.2 : -0.8,
        repeatPhrases: false,
        drumDensity: fromChorus ? 26 : 16,
        centerShift: fromChorus ? 3 : 1,
        chordEnd: fromChorus ? 5 : 1,
        skipCadence: true,
        holdPairs: !fromChorus,
      },
    }
  }
  return {
    quiet: true,
    options: {
      ...base,
      minBars: 2,
      restChoices: fromChorus ? [12, 20, 30] : [28, 36, 45],
      melodyDensity: -1,
      repeatPhrases: false,
      drumDensity: fromChorus ? 16 : 8,
      centerShift: fromChorus ? 1 : 0,
      chordStart: 1,
      chordEnd: 1,
      holdPairs: true,
      skipCadence: false,
      arrangeDrums: false,
    },
  }
}

/** Role keeps the shape. Mood picks the groove when the two lists overlap. */
function drumsFor(profile: AutofillOptions, mood: MoodPreset | null): readonly DrumStyleId[] {
  const roleDrums = profile.drumStyles ?? ['eight_beat']
  if (!mood) return roleDrums
  const shared = roleDrums.filter((style) => mood.drumStyles.includes(style))
  return shared.length > 0 ? shared : mood.drumStyles
}

function lastPlayedPitch(phrases: Phrase[]): number | undefined {
  for (let p = phrases.length - 1; p >= 0; p--) {
    const notes = phrases[p]!.notes
    for (let i = notes.length - 1; i >= 0; i--) {
      if (!notes[i]!.rest) return notes[i]!.pitch
    }
  }
  return undefined
}

/** Last bar becomes one held pitch, so the outro rings instead of stopping short. */
function holdFinalBar(
  phrases: Phrase[],
  fallbackPitch: number,
  chord?: ChordBar,
): void {
  const last = phrases[phrases.length - 1]
  if (!last) return
  const held = lastPlayedPitch(phrases) ?? fallbackPitch
  // The held note may come from an earlier bar; keep it inside the final chord.
  const pitch = chord ? nearestChordTone(held, chord) : held
  last.notes = [{ pitch, duration: '1n' }]
}

function silenceFinalDrumBar(phrases: DrumPhrase[]): void {
  const totalBars = phrases.reduce((sum, phrase) => sum + phrase.bars, 0)
  if (totalBars < 1) return
  const cut = (totalBars - 1) * 4
  let origin = 0
  for (const phrase of phrases) {
    phrase.hits = phrase.hits.filter((hit) => origin + hit.beat < cut - 1e-9)
    origin += phrase.bars * 4
  }
}

function sustainOutro(block: {
  melody: Phrase[]
  chords: ChordBar[]
  bass: Phrase[]
  drums: DrumPhrase[]
}): void {
  const key = block.melody.at(-1)?.keyRoot ?? block.chords.at(-1)?.keyRoot ?? 0
  const tonic = ((key % 12) + 12) % 12
  const lastChord = block.chords.at(-1)
  holdFinalBar(block.melody, 60 + tonic, lastChord)
  if (lastChord) lastChord.sustain = true
  holdFinalBar(block.bass, lastChord ? chordRootMidiFromBar(lastChord, 3) : 48 + tonic)
  silenceFinalDrumBar(block.drums)
}

/**
 * How this section plays its chords. Quiet sections (intro, C, outro, a quiet
 * interlude) lean toward the mood's arpeggios; the rest pick from the mood.
 */
function chordStyleFor(
  role: SectionRole,
  quiet: boolean,
  mood: MoodPreset | null,
): ConcreteChordPlayStyle {
  const pool = mood?.chordStyles.length ? mood.chordStyles : CONCRETE_STYLES
  const arps = pool.filter((s) => ARPEGGIO_STYLES.includes(s))
  if ((quiet || role === 'outro') && arps.length > 0 && Math.random() < 0.65) {
    return pick(arps)
  }
  return pick(pool)
}

/** Bass groove: the role's own rhythm or the mood's, half and half. */
function bassFor(profile: AutofillOptions, mood: MoodPreset | null): AutofillOptions['bassRhythms'] {
  if (!mood || Math.random() < 0.5) return profile.bassRhythms
  return mood.bassRhythms
}

/**
 * Candidates for one section. Each candidate gets its own song feel unless
 * one is passed in (a full song shares one feel so its sections belong together).
 */
export function generateSectionCandidates(
  role: SectionRole,
  bars: number,
  keyRoot: number,
  scale: ScaleType,
  bpm: number,
  count = SECTION_CANDIDATE_COUNT,
  mood: MoodPreset | null = null,
  feel?: SongFeel,
  /** Reuse one chord style per role (a full song keeps A, B, chorus consistent). */
  chordStyles?: Map<SectionRole, ConcreteChordPlayStyle>,
): SectionCandidate[] {
  return Array.from({ length: count }, (_, i) => {
    const { options, quiet } = resolveProfile(role)
    const styles = drumsFor(options, mood)
    const result = generateAutofillSong(bars, keyRoot, scale, bpm, {
      ...options,
      melodyDensity: (options.melodyDensity ?? 0) + (mood?.density ?? 0),
      bassRhythms: bassFor(options, mood),
      feel: feel ?? randomSongFeel(),
      drumStyles: [pick(styles)],
      arrangeDrums: quiet ? false : i % 2 === 1,
    })
    const chordStyle = chordStyles?.get(role) ?? chordStyleFor(role, quiet, mood)
    chordStyles?.set(role, chordStyle)
    for (const bar of result.chords) bar.playStyle = chordStyle
    if (role === 'outro') sustainOutro(result)
    return {
      id: uid('cand'),
      role,
      bars: result.bars,
      melody: result.melody,
      chords: result.chords,
      bass: result.bass,
      drums: result.drums,
    }
  })
}

/** Intro through outro, one take of each role, in song order. */
export function generateFullSong(
  keyRoot: number,
  scale: ScaleType,
  bpm: number,
  mood: MoodPreset | null = null,
): SectionCandidate[] {
  const feel = randomSongFeel()
  const chordStyles = new Map<SectionRole, ConcreteChordPlayStyle>()
  return FULL_SONG_ROLES.map((role) => {
    const made = generateSectionCandidates(
      role,
      sectionRoleMeta(role).defaultBars,
      keyRoot,
      scale,
      bpm,
      1,
      mood,
      feel,
      chordStyles,
    )
    return made[0]!
  })
}

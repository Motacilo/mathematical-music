import { generateAutofillSong, type AutofillOptions } from '../autofill/generate'
import { chordRootMidiFromBar, uid } from '../chords/theory'
import { nearestChordTone } from '../harmony/fitMelody'
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
    melodyRhythms: ['quarters', 'quarters', 'eighths'],
    restChoices: [25, 35, 40],
    bassRhythms: ['quarters'],
    drumStyles: ['ballad', 'half_time'],
    arrangeDrums: false,
    drumDensity: 12,
    centerShift: 0,
    centerJitter: [-1, 0, 0, 1],
    chordStart: 1,
    chordEnd: 1,
    holdPairs: true,
    skipCadence: true,
  },
  a: {
    minBars: 2,
    melodyRhythms: ['eighths', 'quarters', 'eighths'],
    restChoices: [8, 10, 15],
    bassRhythms: ['quarters', 'eighths'],
    drumStyles: ['eight_beat', 'eight_beat', 'rock'],
    arrangeDrums: false,
    drumDensity: 20,
    centerJitter: [-1, 0, 0, 1],
    chordStart: 1,
  },
  b: {
    minBars: 2,
    melodyRhythms: ['eighths', 'eighths', 'mixed_8_4'],
    restChoices: [0, 5, 8],
    bassRhythms: ['eighths'],
    drumStyles: ['eight_beat', 'sixteen_beat'],
    arrangeDrums: true,
    drumDensity: 42,
    centerShift: 2,
    centerJitter: [0, 1, 1, 2],
    chordStart: 4,
    chordEnd: 5,
    skipCadence: true,
  },
  chorus: {
    minBars: 2,
    melodyRhythms: ['eighths', 'eighths'],
    restChoices: [0, 0, 5],
    bassRhythms: ['eighths', 'quarters'],
    drumStyles: ['four_on_floor', 'eight_beat', 'eight_beat'],
    arrangeDrums: true,
    drumDensity: 36,
    centerShift: 5,
    centerJitter: [-1, 0, 1, 2],
    chordStart: 1,
    chordEnd: 1,
  },
  c: {
    minBars: 2,
    melodyRhythms: ['quarters', 'eighths'],
    restChoices: [15, 20, 25],
    bassRhythms: ['quarters'],
    drumStyles: ['half_time', 'ballad'],
    arrangeDrums: false,
    drumDensity: 16,
    centerShift: -2,
    centerJitter: [-2, -1, 0, 1],
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

export function generateSectionCandidates(
  role: SectionRole,
  bars: number,
  keyRoot: number,
  scale: ScaleType,
  bpm: number,
  count = SECTION_CANDIDATE_COUNT,
  mood: MoodPreset | null = null,
): SectionCandidate[] {
  return Array.from({ length: count }, (_, i) => {
    const { options, quiet } = resolveProfile(role)
    const styles = drumsFor(options, mood)
    const result = generateAutofillSong(bars, keyRoot, scale, bpm, {
      ...options,
      drumStyles: [pick(styles)],
      arrangeDrums: quiet ? false : i % 2 === 1,
    })
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
  return FULL_SONG_ROLES.map((role) => {
    const made = generateSectionCandidates(
      role,
      sectionRoleMeta(role).defaultBars,
      keyRoot,
      scale,
      bpm,
      1,
      mood,
    )
    return made[0]!
  })
}

import type { ChordPlayStyleId } from '../projectTypes'
import type { DrumStyleId } from '../drums/generate'
import type { RhythmId, ScaleType } from '../types'

export type MoodId = 'bright' | 'wistful' | 'drive' | 'calm' | 'cool'

export interface MoodPreset {
  id: MoodId
  label: string
  blurb: string
  scale: ScaleType
  /** Pitch-class roots to sample. Hidden from the start screen. */
  keys: number[]
  bpm: readonly [number, number]
  drumStyles: readonly DrumStyleId[]
  /** Melody rhythm lean: -1 sparse … +1 busy */
  density: number
  restChoices: readonly number[]
  bassRhythms: readonly RhythmId[]
  playStyle: ChordPlayStyleId
}

export const MOODS: readonly MoodPreset[] = [
  {
    id: 'bright',
    label: '明るい',
    blurb: '軽くて前向き',
    scale: 'major',
    keys: [0, 7, 2, 5],
    bpm: [130, 149],
    drumStyles: ['eight_beat', 'four_on_floor'],
    density: 0.4,
    restChoices: [0, 0, 5],
    bassRhythms: ['eighths', 'quarters'],
    playStyle: 'pulse',
  },
  {
    id: 'wistful',
    label: '切ない',
    blurb: 'しっとり、少しさみしい',
    scale: 'minor',
    keys: [9, 4, 2, 11],
    bpm: [86, 108],
    drumStyles: ['ballad', 'half_time'],
    density: -0.6,
    restChoices: [10, 15, 20],
    bassRhythms: ['quarters', 'quarters'],
    playStyle: 'broken',
  },
  {
    id: 'drive',
    label: '疾走',
    blurb: '速くて勢いがある',
    scale: 'minor',
    keys: [4, 9, 2, 7],
    bpm: [158, 182],
    drumStyles: ['sixteen_beat', 'four_on_floor'],
    density: 0.9,
    restChoices: [0, 0, 5],
    bassRhythms: ['eighths', 'eighths'],
    playStyle: 'pulse',
  },
  {
    id: 'calm',
    label: 'おだやか',
    blurb: 'ゆったりめ',
    scale: 'major',
    keys: [0, 5, 7, 9],
    bpm: [91, 115],
    drumStyles: ['ballad', 'eight_beat'],
    density: -0.7,
    restChoices: [8, 12, 15],
    bassRhythms: ['quarters'],
    playStyle: 'alberti',
  },
  {
    id: 'cool',
    label: 'かっこいい',
    blurb: '硬めのノリ',
    scale: 'minor',
    keys: [2, 9, 4, 7],
    bpm: [115, 137],
    drumStyles: ['rock', 'half_time'],
    density: 0.2,
    restChoices: [5, 10],
    bassRhythms: ['eighths', 'quarters'],
    playStyle: 'block',
  },
]

const MOOD_IDS = new Set<string>(MOODS.map((m) => m.id))

export function isMoodId(value: unknown): value is MoodId {
  return typeof value === 'string' && MOOD_IDS.has(value)
}

export function moodById(id: MoodId): MoodPreset {
  const found = MOODS.find((m) => m.id === id)
  if (!found) throw new Error(`unknown mood: ${id}`)
  return found
}

/** One key and tempo for a song in this mood. Later sections keep them. */
export function sampleMoodSetup(mood: MoodPreset): {
  keyRoot: number
  scale: MoodPreset['scale']
  bpm: number
} {
  const keyRoot = mood.keys[Math.floor(Math.random() * mood.keys.length)]!
  const span = mood.bpm[1] - mood.bpm[0]
  const bpm = mood.bpm[0] + Math.floor(Math.random() * (span + 1))
  return { keyRoot, scale: mood.scale, bpm }
}

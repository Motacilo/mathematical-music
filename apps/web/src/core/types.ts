import type { DistPresetId } from './distributionWeights'
import {
  DEFAULT_HALF_RANGE,
  buildGaussianWeights,
  getDistributionPitches,
  zeroOutOfKeyWeights,
} from './distributionWeights'

export type Duration = '16n' | '8n' | '4n' | '2n' | '8n.' | '4n.'

export type ScaleType = 'major' | 'minor'

export interface Note {
  pitch: number
  duration: Duration
  rest?: boolean
}

export interface Phrase {
  id: string
  notes: Note[]
  bars: 1
  /** Snapshot at generation time */
  bpm: number
  keyRoot: number
  scale: ScaleType
}

export type GenMode = 'distribution' | 'sequence'
export type RhythmId =
  | 'quarters'
  | 'eighths'
  | 'sixteenths'
  | 'mixed_16_8'
  | 'mixed_8_4'
  | 'mixed_16_4'
  | 'mixed_16_8_4'

export interface ProjectSettings {
  keyRoot: number
  scale: ScaleType
  bpm: number
  octave: number
  rhythmId: RhythmId
  candidateCount: number
  /** 0–100: chance each slot becomes a rest */
  restProbability: number
}

export interface DistributionParams {
  weights: number[]
  /** Absolute MIDI pitch shown at the center of the chart */
  centerMidi: number
  /** Semitones each side of center (bin count = 2*halfRange+1) */
  halfRange: number
  /** Spread for gaussian preset (in bin units / semitones) */
  sigma: number
  activePreset: DistPresetId
  /** When true, preset buttons zero out-of-key pitches (custom unchanged) */
  excludeOutOfKey: boolean
}

export function createDefaultDistribution(
  keyRoot = 0,
  octave = 4,
  scale: ScaleType = 'major',
): DistributionParams {
  const halfRange = DEFAULT_HALF_RANGE
  const sigma = 2.2
  // UI と同じ科学ピッチ: octave 4 → C4 (MIDI 60)
  const centerMidi = (octave + 1) * 12 + keyRoot
  const excludeOutOfKey = true
  let weights = buildGaussianWeights(halfRange, sigma)
  if (excludeOutOfKey) {
    const pitches = getDistributionPitches(centerMidi, halfRange)
    weights = zeroOutOfKeyWeights(weights, pitches, keyRoot, scale)
  }
  return {
    weights,
    centerMidi,
    halfRange,
    sigma,
    activePreset: 'gaussian',
    excludeOutOfKey,
  }
}

export interface SequenceParams {
  /** Expression with n (0-based), or comma-separated numbers */
  expression: string
  rangeLowMidi: number
  rangeHighMidi: number
  /** false = key/scale steps, true = chromatic semitones */
  chromaticSteps: boolean
}

export function createDefaultSequence(): SequenceParams {
  // C3 .. B3
  return {
    expression: 'n',
    rangeLowMidi: (3 + 1) * 12 + 0,
    rangeHighMidi: (3 + 1) * 12 + 11,
    chromaticSteps: false,
  }
}

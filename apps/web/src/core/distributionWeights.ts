import type { ScaleType } from './types'
import { getScaleIntervals, KEY_NAMES } from './scale'

export const MIN_HALF_RANGE = 4
export const MAX_HALF_RANGE = 18
export const DEFAULT_HALF_RANGE = 6

export type DistPresetId =
  | 'gaussian'
  | 'ends'
  | 'low'
  | 'high'
  | 'random'
  | 'custom'

export function binCount(halfRange: number): number {
  return 2 * halfRange + 1
}

/** Pitches with selected center in the middle: center-halfRange .. center+halfRange */
export function getDistributionPitches(
  centerMidi: number,
  halfRange: number,
): number[] {
  const lo = Math.max(0, Math.min(127, centerMidi))
  return Array.from({ length: binCount(halfRange) }, (_, i) => {
    const p = lo - halfRange + i
    return Math.max(0, Math.min(127, p))
  })
}

export function centerMidiForKeyTonic(
  keyRoot: number,
  currentCenterMidi: number,
): number {
  const centerOct = Math.floor(currentCenterMidi / 12) - 1
  const pc = ((keyRoot % 12) + 12) % 12
  return Math.max(0, Math.min(127, (centerOct + 1) * 12 + pc))
}

export function pitchLabel(midi: number): string {
  const name = KEY_NAMES[((midi % 12) + 12) % 12]!
  const oct = Math.floor(midi / 12) - 1
  return `${name}${oct}`
}

export function isPitchInScale(
  midi: number,
  keyRoot: number,
  scale: ScaleType,
): boolean {
  const intervals = getScaleIntervals(scale)
  const pc = ((midi % 12) + 12) % 12
  const rootPc = ((keyRoot % 12) + 12) % 12
  const relative = (pc - rootPc + 12) % 12
  return intervals.includes(relative)
}

function gaussianPdf(x: number, mean: number, sigma: number): number {
  const s = Math.max(sigma, 0.2)
  const z = (x - mean) / s
  return Math.exp(-0.5 * z * z)
}

export function buildGaussianWeights(
  halfRange: number,
  sigma: number,
): number[] {
  const length = binCount(halfRange)
  const centerIndex = halfRange
  return Array.from({ length }, (_, i) =>
    gaussianPdf(i, centerIndex, sigma),
  )
}

export function buildEndsWeights(halfRange: number, sigma: number): number[] {
  const length = binCount(halfRange)
  return Array.from({ length }, (_, i) =>
    gaussianPdf(i, 0, sigma) + gaussianPdf(i, length - 1, sigma),
  )
}

export function buildLowWeights(halfRange: number, sigma: number): number[] {
  const length = binCount(halfRange)
  return Array.from({ length }, (_, i) => gaussianPdf(i, 0, sigma))
}

export function buildHighWeights(halfRange: number, sigma: number): number[] {
  const length = binCount(halfRange)
  return Array.from({ length }, (_, i) =>
    gaussianPdf(i, length - 1, sigma),
  )
}

export function buildRandomWeights(halfRange: number): number[] {
  return Array.from({ length: binCount(halfRange) }, () => 1)
}

export function normalizeWeights(weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + Math.max(0, b), 0)
  if (total <= 1e-9) {
    return weights.map(() => 1 / Math.max(1, weights.length))
  }
  return weights.map((w) => Math.max(0, w) / total)
}

export function sampleFromWeights(weights: number[]): number {
  const norm = normalizeWeights(weights)
  let r = Math.random()
  for (let i = 0; i < norm.length; i++) {
    r -= norm[i]!
    if (r <= 0) return i
  }
  return norm.length - 1
}

export function weightsFromPreset(
  preset: Exclude<DistPresetId, 'custom'>,
  halfRange: number,
  sigma: number,
  options?: {
    excludeOutOfKey?: boolean
    centerMidi?: number
    keyRoot?: number
    scale?: ScaleType
  },
): number[] {
  let weights: number[]
  switch (preset) {
    case 'gaussian':
      weights = buildGaussianWeights(halfRange, sigma)
      break
    case 'ends':
      weights = buildEndsWeights(halfRange, sigma)
      break
    case 'low':
      weights = buildLowWeights(halfRange, sigma)
      break
    case 'high':
      weights = buildHighWeights(halfRange, sigma)
      break
    case 'random':
      weights = buildRandomWeights(halfRange)
      break
  }

  if (
    options?.excludeOutOfKey &&
    options.centerMidi != null &&
    options.keyRoot != null &&
    options.scale != null
  ) {
    const pitches = getDistributionPitches(options.centerMidi, halfRange)
    weights = zeroOutOfKeyWeights(
      weights,
      pitches,
      options.keyRoot,
      options.scale,
    )
  }

  return weights
}

/** Set weight to 0 for pitches outside the key/scale. */
export function zeroOutOfKeyWeights(
  weights: number[],
  pitches: number[],
  keyRoot: number,
  scale: ScaleType,
): number[] {
  return weights.map((w, i) => {
    const midi = pitches[i]
    if (midi == null) return 0
    return isPitchInScale(midi, keyRoot, scale) ? w : 0
  })
}

/** Keep custom weights aligned by offset from center when range changes. */
export function remapWeightsForRange(
  weights: number[],
  oldHalf: number,
  newHalf: number,
): number[] {
  const next = Array.from({ length: binCount(newHalf) }, () => 0)
  for (let i = 0; i < next.length; i++) {
    const offset = i - newHalf
    const oldIndex = offset + oldHalf
    if (oldIndex >= 0 && oldIndex < weights.length) {
      next[i] = weights[oldIndex]!
    }
  }
  if (next.every((w) => w <= 0)) {
    return buildRandomWeights(newHalf)
  }
  return next
}

export function presetUsesSigma(
  preset: DistPresetId,
): preset is 'gaussian' | 'ends' | 'low' | 'high' {
  return (
    preset === 'gaussian' ||
    preset === 'ends' ||
    preset === 'low' ||
    preset === 'high'
  )
}

export const PRESET_LABELS: Record<Exclude<DistPresetId, 'custom'>, string> = {
  gaussian: '真ん中が多い',
  ends: '両端が多い',
  low: '低音側が多い',
  high: '高音側が多い',
  random: '完全ランダム',
}

export const HALF_RANGE_OPTIONS: { value: number; label: string }[] = [
  { value: 4, label: '±4半音' },
  { value: 6, label: '±6半音（1オクターブ）' },
  { value: 9, label: '±9半音' },
  { value: 12, label: '±12半音（2オクターブ）' },
  { value: 18, label: '±18半音（3オクターブ）' },
]

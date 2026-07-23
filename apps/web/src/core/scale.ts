import type { ScaleType } from './types'

const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11]
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10]

export const KEY_NAMES = [
  'C',
  'C#',
  'D',
  'Eb',
  'E',
  'F',
  'F#',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
] as const

export function getScaleIntervals(scale: ScaleType): number[] {
  return scale === 'major' ? MAJOR_INTERVALS : MINOR_INTERVALS
}

/** 1-based scale degree → MIDI pitch (degrees wrap across octaves). */
export function degreeToMidi(
  degree: number,
  keyRoot: number,
  scale: ScaleType,
  octave: number,
): number {
  const intervals = getScaleIntervals(scale)
  const n = intervals.length
  const zeroBased = degree - 1
  const octaveOffset = Math.floor(zeroBased / n)
  const index = ((zeroBased % n) + n) % n
  return (octave + octaveOffset) * 12 + keyRoot + intervals[index]!
}

export function midiToDegree(
  midi: number,
  keyRoot: number,
  scale: ScaleType,
  octave: number,
): number | null {
  const intervals = getScaleIntervals(scale)
  const n = intervals.length
  const base = octave * 12 + keyRoot
  const relative = midi - base
  for (let oct = -2; oct <= 4; oct++) {
    for (let i = 0; i < n; i++) {
      if (relative === oct * 12 + intervals[i]!) {
        return oct * n + i + 1
      }
    }
  }
  return null
}

export function snapToScale(
  midi: number,
  keyRoot: number,
  scale: ScaleType,
): number {
  const intervals = getScaleIntervals(scale)
  const pc = ((midi % 12) + 12) % 12
  const rootPc = ((keyRoot % 12) + 12) % 12
  const relative = ((pc - rootPc) + 12) % 12
  let best = intervals[0]!
  let bestDist = Infinity
  for (const iv of intervals) {
    const d = Math.min(
      Math.abs(iv - relative),
      12 - Math.abs(iv - relative),
    )
    if (d < bestDist) {
      bestDist = d
      best = iv
    }
  }
  const octave = Math.floor(midi / 12)
  let candidate = octave * 12 + rootPc + best
  if (Math.abs(candidate - midi) > 6) {
    candidate += candidate > midi ? -12 : 12
  }
  return candidate
}

export function shiftDegree(
  midi: number,
  delta: number,
  keyRoot: number,
  scale: ScaleType,
  octave: number,
): number {
  const degree = midiToDegree(midi, keyRoot, scale, octave)
  if (degree == null) {
    return snapToScale(midi + delta, keyRoot, scale)
  }
  return degreeToMidi(degree + delta, keyRoot, scale, octave)
}

export function midiToNoteName(midi: number): string {
  const name = KEY_NAMES[((midi % 12) + 12) % 12]!
  const oct = Math.floor(midi / 12) - 1
  return `${name}${oct}`
}

export function getScaleMidiRange(
  keyRoot: number,
  scale: ScaleType,
  octave: number,
  degreesBelow = 0,
  degreesAbove = 7,
): number[] {
  const result: number[] = []
  for (let d = 1 - degreesBelow; d <= 1 + degreesAbove; d++) {
    result.push(degreeToMidi(d, keyRoot, scale, octave))
  }
  return result
}

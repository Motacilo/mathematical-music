import type { ScaleType } from '../types'

/**
 * Transition weights: fromDegree (1–7) → toDegree (1–7) → weight.
 * Biased toward common progressions / cadences (V→I thicker).
 */
export const MAJOR_TRANSITION: number[][] = [
  // from I
  [1, 2, 2, 4, 5, 4, 1],
  // ii
  [1, 1, 1, 2, 6, 2, 1],
  // iii
  [2, 1, 1, 3, 2, 4, 1],
  // IV
  [3, 2, 1, 1, 5, 3, 1],
  // V
  [8, 1, 1, 2, 1, 3, 2],
  // vi
  [2, 3, 1, 4, 3, 1, 1],
  // vii°
  [6, 1, 1, 1, 3, 1, 1],
]

export const MINOR_TRANSITION: number[][] = [
  // i
  [1, 2, 2, 4, 5, 3, 3],
  // ii°
  [1, 1, 1, 2, 6, 2, 1],
  // III
  [2, 1, 1, 3, 2, 4, 2],
  // iv
  [3, 2, 1, 1, 5, 2, 2],
  // v
  [8, 1, 1, 2, 1, 2, 3],
  // VI
  [2, 2, 3, 4, 2, 1, 2],
  // VII
  [5, 1, 2, 2, 3, 2, 1],
]

export function transitionTable(scale: ScaleType): number[][] {
  return scale === 'major' ? MAJOR_TRANSITION : MINOR_TRANSITION
}

export type PresetProgression = {
  id: string
  label: string
  degrees: number[]
}

export const MAJOR_PRESETS: PresetProgression[] = [
  { id: 'pop', label: 'I–V–vi–IV', degrees: [1, 5, 6, 4] },
  { id: 'canon', label: 'I–V–vi–iii–IV–I–IV–V', degrees: [1, 5, 6, 3, 4, 1, 4, 5] },
  { id: 'twofive', label: 'ii–V–I–I', degrees: [2, 5, 1, 1] },
  { id: 'onefourfive', label: 'I–IV–V–I', degrees: [1, 4, 5, 1] },
  { id: 'sad', label: 'vi–IV–I–V', degrees: [6, 4, 1, 5] },
]

export const MINOR_PRESETS: PresetProgression[] = [
  { id: 'natural', label: 'i–VI–III–VII', degrees: [1, 6, 3, 7] },
  { id: 'andulus', label: 'i–VII–VI–V', degrees: [1, 7, 6, 5] },
  { id: 'twofive_m', label: 'ii°–V–i–i', degrees: [2, 5, 1, 1] },
  { id: 'ifour', label: 'i–iv–V–i', degrees: [1, 4, 5, 1] },
  { id: 'loop', label: 'i–iv–VII–III', degrees: [1, 4, 7, 3] },
]

export function presetsForScale(scale: ScaleType): PresetProgression[] {
  return scale === 'major' ? MAJOR_PRESETS : MINOR_PRESETS
}

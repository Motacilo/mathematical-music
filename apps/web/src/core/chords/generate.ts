import type {
  ChordBar,
  ChordQuality,
  QualityEnableMap,
} from '../projectTypes'
import type { ScaleType } from '../types'
import {
  makeChordBarFromRoot,
  pickQualityForRoot,
  pickRootId,
} from './theory'
import {
  type ChordRootId,
  type RootEnableMap,
  enabledRoots,
  rootIdFromDegree,
} from './roots'
import { presetsForScale, transitionTable } from './transitions'

function pickWeighted(weights: number[]): number {
  const sum = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * (sum || 1)
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]!
    if (r <= 0) return i
  }
  return weights.length - 1
}

function barFromRoot(
  rootId: ChordRootId,
  keyRoot: number,
  scale: ScaleType,
  bpm: number,
  qualityEnable: QualityEnableMap,
): ChordBar {
  return makeChordBarFromRoot(
    rootId,
    pickQualityForRoot(rootId, scale, qualityEnable),
    keyRoot,
    scale,
    bpm,
  )
}

function pickEnabledRootNearDegree(
  degree: number,
  scale: ScaleType,
  rootEnable: RootEnableMap,
): ChordRootId | null {
  const preferred = rootIdFromDegree(degree, scale)
  if (rootEnable[preferred]) return preferred
  return pickRootId(rootEnable)
}

/** Random progression from enabled roots */
export function generateRandomProgression(
  barCount: number,
  keyRoot: number,
  scale: ScaleType,
  bpm: number,
  qualityEnable: QualityEnableMap,
  rootEnable: RootEnableMap,
): ChordBar[] {
  const pool = enabledRoots(rootEnable)
  if (pool.length === 0) return []
  const out: ChordBar[] = []
  for (let i = 0; i < barCount; i++) {
    const rootId = pool[Math.floor(Math.random() * pool.length)]!
    out.push(barFromRoot(rootId, keyRoot, scale, bpm, qualityEnable))
  }
  return out
}

/**
 * Markov on diatonic degrees, then map to enabled roots
 * (chromatic roots are injected randomly ~15% when enabled).
 */
export function generateMarkovProgression(
  barCount: number,
  keyRoot: number,
  scale: ScaleType,
  bpm: number,
  qualityEnable: QualityEnableMap,
  rootEnable: RootEnableMap,
  startDegree = 1,
): ChordBar[] {
  const table = transitionTable(scale)
  const degrees: number[] = [startDegree]
  for (let i = 1; i < barCount; i++) {
    const from = degrees[i - 1]! - 1
    const row = table[from]!
    degrees.push(pickWeighted(row) + 1)
  }

  const chromatic = enabledRoots(rootEnable).filter((id) => {
    const defMajor = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']
    const defMinor = ['I', 'II', 'bIII', 'IV', 'V', 'bVI', 'bVII']
    const dia = scale === 'major' ? defMajor : defMinor
    return !dia.includes(id)
  })

  return degrees.map((degree) => {
    let rootId = pickEnabledRootNearDegree(degree, scale, rootEnable)
    if (
      rootId &&
      chromatic.length > 0 &&
      Math.random() < 0.12
    ) {
      rootId = chromatic[Math.floor(Math.random() * chromatic.length)]!
    }
    if (!rootId) rootId = pickRootId(rootEnable) ?? 'I'
    return barFromRoot(rootId, keyRoot, scale, bpm, qualityEnable)
  })
}

export function generateCandidateProgressions(
  mode: 'random' | 'markov',
  count: number,
  barCount: number,
  keyRoot: number,
  scale: ScaleType,
  bpm: number,
  qualityEnable: QualityEnableMap,
  rootEnable: RootEnableMap,
): ChordBar[][] {
  const out: ChordBar[][] = []
  for (let i = 0; i < count; i++) {
    if (mode === 'random') {
      out.push(
        generateRandomProgression(
          barCount,
          keyRoot,
          scale,
          bpm,
          qualityEnable,
          rootEnable,
        ),
      )
    } else {
      const start = 1 + Math.floor(Math.random() * 3)
      out.push(
        generateMarkovProgression(
          barCount,
          keyRoot,
          scale,
          bpm,
          qualityEnable,
          rootEnable,
          start,
        ),
      )
    }
  }
  return out
}

export function progressionFromPreset(
  presetId: string,
  keyRoot: number,
  scale: ScaleType,
  bpm: number,
  qualityEnable: QualityEnableMap,
  rootEnable: RootEnableMap,
): ChordBar[] | null {
  const preset = presetsForScale(scale).find((p) => p.id === presetId)
  if (!preset) return null
  return preset.degrees.map((degree) => {
    const rootId =
      pickEnabledRootNearDegree(degree, scale, rootEnable) ??
      rootIdFromDegree(degree, scale)
    return barFromRoot(rootId, keyRoot, scale, bpm, qualityEnable)
  })
}

export function appendChordRoot(
  stage: ChordBar[],
  rootId: ChordRootId,
  quality: ChordQuality,
  keyRoot: number,
  scale: ScaleType,
  bpm: number,
): ChordBar[] {
  return [
    ...stage,
    makeChordBarFromRoot(rootId, quality, keyRoot, scale, bpm),
  ]
}

export function qualityForFreeAdd(
  rootId: ChordRootId,
  scale: ScaleType,
  qualityEnable: QualityEnableMap,
): ChordQuality {
  return pickQualityForRoot(rootId, scale, qualityEnable)
}

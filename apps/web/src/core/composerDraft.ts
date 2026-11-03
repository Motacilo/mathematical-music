import { storageGet, storageRemove, storageSet } from './safeStorage'
import {
  createDefaultDistribution,
  createDefaultSequence,
  type DistributionParams,
  type GenMode,
  type Phrase,
  type ProjectSettings,
  type SequenceParams,
} from './types'

const COMPOSER_DRAFT_KEY = 'mm-composer-draft-v1'
const LEGACY_STAGE_SESSION_KEY = 'mm-stage-draft-v1'

export interface ComposerDraft {
  version: 1
  mode: GenMode
  settings: ProjectSettings
  distribution: DistributionParams
  sequence: SequenceParams
  candidates: Phrase[]
  stage: Phrase[]
  bpmInput: string
  restProbInput: string
  candidateKeyRoot: number
  candidateBpm: number
  candidateBpmInput: string
  stageBpmInput: string
}

function readJsonLocal<T>(key: string): T | null {
  try {
    const raw = storageGet('local', key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function readComposerDraft(): ComposerDraft | null {
  const draft = readJsonLocal<ComposerDraft>(COMPOSER_DRAFT_KEY)
  if (draft && draft.version === 1 && Array.isArray(draft.stage)) {
    return draft
  }

  // Migrate older session-only stage draft once
  try {
    const legacy = storageGet('session', LEGACY_STAGE_SESSION_KEY)
    if (legacy) {
      const stage = JSON.parse(legacy) as Phrase[]
      if (Array.isArray(stage) && stage.length > 0) {
        return {
          version: 1,
          mode: 'distribution',
          settings: {
            keyRoot: 0,
            scale: 'major',
            bpm: 160,
            octave: 4,
            rhythmId: 'eighths',
            barCount: 1,
            candidateCount: 8,
            restProbability: 0,
          },
          distribution: createDefaultDistribution(),
          sequence: createDefaultSequence(),
          candidates: [],
          stage,
          bpmInput: '160',
          restProbInput: '0',
          candidateKeyRoot: 0,
          candidateBpm: 160,
          candidateBpmInput: '160',
          stageBpmInput: String(stage[0]?.bpm ?? 160),
        }
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

export function writeComposerDraft(draft: ComposerDraft): void {
  storageSet('local', COMPOSER_DRAFT_KEY, JSON.stringify(draft))
  // Keep stage mirror for older helpers / pending append
  storageRemove('session', LEGACY_STAGE_SESSION_KEY)
}

export function readStageFromDraft(): Phrase[] {
  return readComposerDraft()?.stage ?? []
}

export function patchComposerStage(stage: Phrase[]): void {
  const current = readComposerDraft()
  if (!current) {
    writeComposerDraft({
      version: 1,
      mode: 'distribution',
      settings: {
        keyRoot: 0,
        scale: 'major',
        bpm: 160,
        octave: 4,
        rhythmId: 'eighths',
        barCount: 1,
        candidateCount: 8,
        restProbability: 0,
      },
      distribution: createDefaultDistribution(),
      sequence: createDefaultSequence(),
      candidates: [],
      stage,
      bpmInput: '160',
      restProbInput: '0',
      candidateKeyRoot: 0,
      candidateBpm: 160,
      candidateBpmInput: '160',
      stageBpmInput: String(stage[0]?.bpm ?? 160),
    })
    return
  }
  writeComposerDraft({
    ...current,
    stage,
    stageBpmInput:
      stage.length > 0
        ? String(stage[0]!.bpm)
        : current.stageBpmInput,
  })
}

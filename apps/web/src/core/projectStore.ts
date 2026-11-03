import { storageGet, storageSet } from './safeStorage'
import {
  createDefaultDistribution,
  createDefaultSequence,
  type Phrase,
} from './types'
import {
  createDefaultBassLayer,
  createDefaultChordsLayer,
  createDefaultDrumsLayer,
  createDefaultKeySync,
  createDefaultLayerInclude,
  createDefaultMixer,
  createDefaultQualityEnable,
  type BassLayerState,
  type ChordsLayerState,
  type DrumsLayerState,
  type KeySyncState,
  type LayerIncludeState,
  type MixerState,
  type ProjectMeta,
} from './projectTypes'
import { createDefaultRootEnable } from './chords/roots'
import { normalizeChordBar } from './chords/theory'
import {
  readComposerDraft,
  type ComposerDraft,
  writeComposerDraft,
} from './composerDraft'
import { createDefaultTones, normalizeToneMap, type ToneMap } from './tones/presets'
import { isMoodId, type MoodId } from './mood/presets'
import { normalizeSections, type SongSection } from './sections/roles'

const PROJECT_DRAFT_KEY = 'mm-project-draft-v2'

export interface ProjectDraft {
  version: 2
  meta: ProjectMeta
  mixer: MixerState
  /** Checked layers for arrange play / WAV / MIDI */
  layerInclude: LayerIncludeState
  keySync: KeySyncState
  tones: ToneMap
  /** Song atmosphere. Null on drafts made before moods were stored. */
  moodId: MoodId | null
  sections: SongSection[]
  melody: ComposerDraft
  chords: ChordsLayerState
  bass: BassLayerState
  drums: DrumsLayerState
}

function defaultMeta(): ProjectMeta {
  return { keyRoot: 0, scale: 'major', bpm: 160 }
}

function emptyMelodyDraft(meta: ProjectMeta): ComposerDraft {
  return {
    version: 1,
    mode: 'distribution',
    settings: {
      keyRoot: meta.keyRoot,
      scale: meta.scale,
      bpm: meta.bpm,
      octave: 4,
      rhythmId: 'eighths',
      barCount: 1,
      candidateCount: 8,
      restProbability: 0,
    },
    distribution: createDefaultDistribution(
      meta.keyRoot,
      4,
      meta.scale,
    ),
    sequence: createDefaultSequence(),
    candidates: [],
    stage: [],
    bpmInput: String(meta.bpm),
    restProbInput: '0',
    candidateKeyRoot: meta.keyRoot,
    candidateBpm: meta.bpm,
    candidateBpmInput: String(meta.bpm),
    stageBpmInput: String(meta.bpm),
  }
}

export function createEmptyProjectDraft(
  melody?: ComposerDraft | null,
): ProjectDraft {
  const meta = defaultMeta()
  if (melody) {
    meta.keyRoot = melody.settings.keyRoot
    meta.scale = melody.settings.scale
    meta.bpm = melody.settings.bpm
  }
  return {
    version: 2,
    meta,
    mixer: createDefaultMixer(),
    layerInclude: createDefaultLayerInclude(),
    keySync: createDefaultKeySync(),
    tones: createDefaultTones(),
    moodId: null,
    sections: [],
    melody: melody ?? emptyMelodyDraft(meta),
    chords: createDefaultChordsLayer(meta),
    bass: createDefaultBassLayer(meta),
    drums: createDefaultDrumsLayer(),
  }
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

export function readProjectDraft(): ProjectDraft {
  const v2 = readJsonLocal<ProjectDraft>(PROJECT_DRAFT_KEY)
  if (v2 && v2.version === 2 && v2.melody) {
    if (!v2.layerInclude) {
      v2.layerInclude = createDefaultLayerInclude()
    }
    if (!v2.chords.noteLabelMode) {
      v2.chords.noteLabelMode = 'letter'
    }
    if (!v2.chords.qualityEnable) {
      v2.chords.qualityEnable = createDefaultQualityEnable()
    }
    if (!v2.chords.rootEnable) {
      v2.chords.rootEnable = createDefaultRootEnable(
        v2.chords.scale ?? v2.meta.scale,
      )
    }
    if (!v2.drums.styleId) {
      v2.drums.styleId = 'any'
    }
    if (!v2.drums.arrangeMode) {
      v2.drums.arrangeMode = 'mixed'
    }
    if (!v2.chords.playStyle) {
      v2.chords.playStyle = 'block'
    }
    v2.tones = normalizeToneMap(v2.tones)
    v2.moodId = isMoodId(v2.moodId) ? v2.moodId : null
    v2.sections = normalizeSections(v2.sections)
    // Drop legacy tonicQualityEnable if present
    delete (v2.chords as { tonicQualityEnable?: unknown }).tonicQualityEnable
    v2.chords.stage = (v2.chords.stage ?? []).map(normalizeChordBar)
    v2.chords.candidates = (v2.chords.candidates ?? []).map((prog) =>
      prog.map(normalizeChordBar),
    )
    return v2
  }
  const v1 = readComposerDraft()
  const migrated = createEmptyProjectDraft(v1)
  writeProjectDraft(migrated)
  return migrated
}

export function writeProjectDraft(draft: ProjectDraft): void {
  storageSet('local', PROJECT_DRAFT_KEY, JSON.stringify(draft))
  writeComposerDraft(draft.melody)
}

export function patchMelodyStage(stage: Phrase[]): void {
  const draft = readProjectDraft()
  draft.melody = {
    ...draft.melody,
    stage,
    stageBpmInput:
      stage.length > 0 ? String(stage[0]!.bpm) : draft.melody.stageBpmInput,
  }
  writeProjectDraft(draft)
}

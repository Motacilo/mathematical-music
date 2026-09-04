import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { transposePhrases } from './transpose'
import {
  readProjectDraft,
  writeProjectDraft,
  type ProjectDraft,
} from './projectStore'
import type {
  BassLayerState,
  ChordsLayerState,
  DrumsLayerState,
  KeySyncState,
  LayerIncludeState,
  MixerState,
  ProjectMeta,
} from './projectTypes'
import type { ComposerDraft } from './composerDraft'
import type { ChordBar } from './projectTypes'
import { keySemitoneDelta } from './transpose'

type ProjectContextValue = {
  draft: ProjectDraft
  setMeta: (patch: Partial<ProjectMeta>) => void
  setMixer: (mixer: MixerState) => void
  setLayerInclude: (patch: Partial<LayerIncludeState>) => void
  setKeySync: (patch: Partial<KeySyncState>) => void
  setMelody: (melody: ComposerDraft) => void
  setChords: (chords: ChordsLayerState | ((c: ChordsLayerState) => ChordsLayerState)) => void
  setBass: (bass: BassLayerState | ((b: BassLayerState) => BassLayerState)) => void
  setDrums: (drums: DrumsLayerState | ((d: DrumsLayerState) => DrumsLayerState)) => void
  effectiveKey: (layer: 'melody' | 'chords' | 'bass') => {
    keyRoot: number
    scale: ProjectMeta['scale']
  }
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

function transposeChordStage(
  stage: ChordBar[],
  fromKey: number,
  toKey: number,
  scale: ProjectMeta['scale'],
): ChordBar[] {
  if (fromKey === toKey) {
    return stage.map((c) => ({ ...c, keyRoot: toKey, scale }))
  }
  return stage.map((c) => ({
    ...c,
    keyRoot: toKey,
    scale,
  }))
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<ProjectDraft>(() => readProjectDraft())

  useEffect(() => {
    writeProjectDraft(draft)
  }, [draft])

  const setMeta = useCallback((patch: Partial<ProjectMeta>) => {
    setDraft((prev) => {
      const nextMeta = { ...prev.meta, ...patch }
      let next = { ...prev, meta: nextMeta }

      if (patch.keyRoot != null || patch.scale != null || patch.bpm != null) {
        const fromKey = prev.meta.keyRoot
        const toKey = nextMeta.keyRoot

        if (prev.keySync.melody && (patch.keyRoot != null || patch.scale != null)) {
          const mel = { ...prev.melody }
          mel.settings = {
            ...mel.settings,
            keyRoot: toKey,
            scale: nextMeta.scale,
            bpm: patch.bpm ?? mel.settings.bpm,
          }
          if (patch.keyRoot != null && fromKey !== toKey) {
            mel.stage = transposePhrases(mel.stage, fromKey, toKey)
            mel.candidates = transposePhrases(mel.candidates, fromKey, toKey)
            mel.candidateKeyRoot = toKey
          }
          if (patch.bpm != null) {
            mel.settings.bpm = patch.bpm
            mel.bpmInput = String(patch.bpm)
          }
          next = { ...next, melody: mel }
        }

        if (prev.keySync.chords && (patch.keyRoot != null || patch.scale != null)) {
          const ch = { ...prev.chords }
          ch.keyRoot = toKey
          ch.scale = nextMeta.scale
          ch.stage = transposeChordStage(ch.stage, fromKey, toKey, nextMeta.scale)
          ch.candidates = ch.candidates.map((prog) =>
            transposeChordStage(prog, fromKey, toKey, nextMeta.scale),
          )
          next = { ...next, chords: ch }
        }

        if (prev.keySync.bass && (patch.keyRoot != null || patch.scale != null)) {
          const bass = { ...prev.bass }
          bass.keyRoot = toKey
          bass.scale = nextMeta.scale
          if (patch.keyRoot != null && fromKey !== toKey) {
            bass.stage = transposePhrases(bass.stage, fromKey, toKey)
            bass.candidates = transposePhrases(bass.candidates, fromKey, toKey)
          }
          next = { ...next, bass }
        }

        if (patch.bpm != null) {
          // Update chord/bass/drums bpm snapshots lightly
          next = {
            ...next,
            chords: {
              ...next.chords,
              stage: next.chords.stage.map((c) => ({ ...c, bpm: patch.bpm! })),
            },
            bass: {
              ...next.bass,
              stage: next.bass.stage.map((p) => ({ ...p, bpm: patch.bpm! })),
            },
            drums: {
              ...next.drums,
              stage: next.drums.stage.map((p) => ({ ...p, bpm: patch.bpm! })),
            },
          }
        }
      }
      return next
    })
  }, [])

  const setMixer = useCallback((mixer: MixerState) => {
    setDraft((p) => ({ ...p, mixer }))
  }, [])

  const setLayerInclude = useCallback((patch: Partial<LayerIncludeState>) => {
    setDraft((p) => ({
      ...p,
      layerInclude: { ...p.layerInclude, ...patch },
    }))
  }, [])

  const setKeySync = useCallback((patch: Partial<KeySyncState>) => {
    setDraft((prev) => {
      const keySync = { ...prev.keySync, ...patch }
      let next = { ...prev, keySync }
      // When turning sync ON, snap layer to project key
      for (const layer of ['melody', 'chords', 'bass'] as const) {
        if (patch[layer] === true) {
          if (layer === 'melody') {
            const from = prev.melody.settings.keyRoot
            const to = prev.meta.keyRoot
            const mel = { ...prev.melody }
            mel.settings = {
              ...mel.settings,
              keyRoot: to,
              scale: prev.meta.scale,
            }
            if (from !== to) {
              mel.stage = transposePhrases(mel.stage, from, to)
              mel.candidates = transposePhrases(mel.candidates, from, to)
            }
            next = { ...next, melody: mel }
          }
          if (layer === 'chords') {
            const from = prev.chords.keyRoot
            const to = prev.meta.keyRoot
            const ch = {
              ...prev.chords,
              keyRoot: to,
              scale: prev.meta.scale,
              stage: transposeChordStage(
                prev.chords.stage,
                from,
                to,
                prev.meta.scale,
              ),
              candidates: prev.chords.candidates.map((prog) =>
                transposeChordStage(prog, from, to, prev.meta.scale),
              ),
            }
            next = { ...next, chords: ch }
          }
          if (layer === 'bass') {
            const from = prev.bass.keyRoot
            const to = prev.meta.keyRoot
            const bass = {
              ...prev.bass,
              keyRoot: to,
              scale: prev.meta.scale,
              stage:
                from !== to
                  ? transposePhrases(prev.bass.stage, from, to)
                  : prev.bass.stage.map((p) => ({
                      ...p,
                      keyRoot: to,
                      scale: prev.meta.scale,
                    })),
              candidates:
                from !== to
                  ? transposePhrases(prev.bass.candidates, from, to)
                  : prev.bass.candidates,
            }
            next = { ...next, bass }
          }
        }
      }
      return next
    })
  }, [])

  const setMelody = useCallback((melody: ComposerDraft) => {
    setDraft((p) => ({ ...p, melody }))
  }, [])

  const setChords = useCallback(
    (
      chords:
        | ChordsLayerState
        | ((c: ChordsLayerState) => ChordsLayerState),
    ) => {
      setDraft((p) => ({
        ...p,
        chords: typeof chords === 'function' ? chords(p.chords) : chords,
      }))
    },
    [],
  )

  const setBass = useCallback(
    (
      bass: BassLayerState | ((b: BassLayerState) => BassLayerState),
    ) => {
      setDraft((p) => ({
        ...p,
        bass: typeof bass === 'function' ? bass(p.bass) : bass,
      }))
    },
    [],
  )

  const setDrums = useCallback(
    (
      drums: DrumsLayerState | ((d: DrumsLayerState) => DrumsLayerState),
    ) => {
      setDraft((p) => ({
        ...p,
        drums: typeof drums === 'function' ? drums(p.drums) : drums,
      }))
    },
    [],
  )

  const effectiveKey = useCallback(
    (layer: 'melody' | 'chords' | 'bass') => {
      if (draft.keySync[layer]) {
        return { keyRoot: draft.meta.keyRoot, scale: draft.meta.scale }
      }
      if (layer === 'melody') {
        return {
          keyRoot: draft.melody.settings.keyRoot,
          scale: draft.melody.settings.scale,
        }
      }
      if (layer === 'chords') {
        return { keyRoot: draft.chords.keyRoot, scale: draft.chords.scale }
      }
      return { keyRoot: draft.bass.keyRoot, scale: draft.bass.scale }
    },
    [draft],
  )

  const value = useMemo(
    () => ({
      draft,
      setMeta,
      setMixer,
      setLayerInclude,
      setKeySync,
      setMelody,
      setChords,
      setBass,
      setDrums,
      effectiveKey,
    }),
    [
      draft,
      setMeta,
      setMixer,
      setLayerInclude,
      setKeySync,
      setMelody,
      setChords,
      setBass,
      setDrums,
      effectiveKey,
    ],
  )

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  )
}

export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProject must be used within ProjectProvider')
  return ctx
}

/** Detect key mismatches for arrange warning */
export function collectKeyWarnings(draft: ProjectDraft): string[] {
  const warnings: string[] = []
  const pk = draft.meta.keyRoot
  const melK = draft.keySync.melody
    ? pk
    : draft.melody.settings.keyRoot
  const chK = draft.keySync.chords ? pk : draft.chords.keyRoot
  const baK = draft.keySync.bass ? pk : draft.bass.keyRoot
  if (melK !== chK && (draft.melody.stage.length || draft.chords.stage.length)) {
    warnings.push('メロディとコードのキーが異なります')
  }
  if (melK !== baK && (draft.melody.stage.length || draft.bass.stage.length)) {
    warnings.push('メロディとベースのキーが異なります')
  }
  if (chK !== baK && (draft.chords.stage.length || draft.bass.stage.length)) {
    warnings.push('コードとベースのキーが異なります')
  }
  void keySemitoneDelta
  return [...new Set(warnings)]
}

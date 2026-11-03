import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlayStopButton } from '../components/PlayStopButton'
import { playPhrase, playPhrases } from '../audio/player'
import { AppFooter } from '../components/AppFooter'
import { KeySyncCheckbox } from '../components/KeySyncCheckbox'
import { ArrangeModal } from '../components/ArrangeModal'
import { CandidatePool } from '../components/CandidatePool'
import { PhraseRoll } from '../components/PhraseRoll'
import {
  generatePhraseArrangeVariants,
  type PhraseArrangeVariant,
} from '../core/arrange/variants'
import { Controls } from '../components/Controls'
import { SectionTuneBar } from '../components/SectionTuneBar'
import { Stage } from '../components/Stage'
import { generateCandidates, maxCandidateCount } from '../core/generators'
import {
  addFavorite,
  addScore,
  defaultScoreName,
  takePendingAppend,
  writeStageDraft,
} from '../core/libraryStore'
import {
  readComposerDraft,
  writeComposerDraft,
  type ComposerDraft,
} from '../core/composerDraft'
import { useProject } from '../core/ProjectContext'
import { labelsForPhrases } from '../core/sections/timeline'
import { readProjectDraft } from '../core/projectStore'
import { splitPhraseIntoBars } from '../core/phraseSplit'
import {
  applyBpmToPhrases,
  keySemitoneDelta,
  transposePhrase,
  transposePhrases,
} from '../core/transpose'
import {
  centerMidiForKeyTonic,
  weightsFromPreset,
} from '../core/distributionWeights'
import { createDefaultDistribution, createDefaultSequence } from '../core/types'
import type { GenMode, Phrase, ProjectSettings } from '../core/types'
import { downloadMidi } from '../export/midi'
import { downloadWav } from '../export/wav'
import './ComposerPage.css'

const DEFAULT_BPM = 160
const DEFAULT_REST_PROB = 0

function defaultCandidateCount(): number {
  return 8
}

const initialSettingsBase: Omit<ProjectSettings, 'candidateCount'> = {
  keyRoot: 0,
  scale: 'major',
  bpm: DEFAULT_BPM,
  octave: 4,
  rhythmId: 'eighths',
  barCount: 1,
  restProbability: DEFAULT_REST_PROB,
}

function parsePositiveBpm(raw: string, fallback: number): number {
  const trimmed = raw.trim()
  const n = Number(trimmed)
  if (trimmed === '' || !Number.isFinite(n) || n <= 0) return fallback
  return Math.round(n)
}

export default function ComposerPage() {
  const { setMelody, draft: projectDraft, setMeta } = useProject()
  const [boot] = useState(() => readProjectDraft().melody)

  const [mode, setMode] = useState<GenMode>(
    () => boot?.mode ?? 'distribution',
  )
  const [settings, setSettings] = useState<ProjectSettings>(() =>
    boot?.settings ?? {
      ...initialSettingsBase,
      candidateCount: defaultCandidateCount(),
    },
  )
  const [distribution, setDistribution] = useState(() =>
    boot?.distribution ??
      createDefaultDistribution(
        initialSettingsBase.keyRoot,
        initialSettingsBase.octave,
        initialSettingsBase.scale,
      ),
  )
  const [sequence, setSequence] = useState(
    () => boot?.sequence ?? createDefaultSequence(),
  )
  const [candidates, setCandidates] = useState<Phrase[]>(
    () => boot?.candidates ?? [],
  )
  const [stage, setStage] = useState<Phrase[]>(() => boot?.stage ?? [])
  const [selected, setSelected] = useState<{
    phraseIndex: number
    noteIndex: number
  } | null>(null)
  const [exporting, setExporting] = useState(false)
  const [bpmInput, setBpmInput] = useState(
    () => boot?.bpmInput ?? String(DEFAULT_BPM),
  )
  const [restProbInput, setRestProbInput] = useState(
    () => boot?.restProbInput ?? String(DEFAULT_REST_PROB),
  )

  const [candidateKeyRoot, setCandidateKeyRoot] = useState(
    () => boot?.candidateKeyRoot ?? initialSettingsBase.keyRoot,
  )
  const [candidateBpm, setCandidateBpm] = useState(
    () => boot?.candidateBpm ?? DEFAULT_BPM,
  )
  const [candidateBpmInput, setCandidateBpmInput] = useState(
    () => boot?.candidateBpmInput ?? String(DEFAULT_BPM),
  )
  const [stageBpmInput, setStageBpmInput] = useState(
    () =>
      boot?.stageBpmInput ?? String(boot?.stage[0]?.bpm ?? DEFAULT_BPM),
  )
  const [saveFlash, setSaveFlash] = useState<string | null>(null)
  const [scoreSaved, setScoreSaved] = useState(false)
  const [favoritedIds, setFavoritedIds] = useState(() => new Set<string>())
  const [clearConfirm, setClearConfirm] = useState<null | 'candidates' | 'stage'>(
    null,
  )
  const [arrangeSource, setArrangeSource] = useState<Phrase | null>(null)
  const [arrangeVariants, setArrangeVariants] = useState<PhraseArrangeVariant[]>(
    [],
  )

  const openArrange = useCallback((phrase: Phrase) => {
    setArrangeSource(phrase)
    setArrangeVariants(generatePhraseArrangeVariants(phrase, 5))
  }, [])

  const refreshArrange = useCallback(() => {
    if (!arrangeSource) return
    setArrangeVariants(generatePhraseArrangeVariants(arrangeSource, 5))
  }, [arrangeSource])

  useEffect(() => {
    const draft: ComposerDraft = {
      version: 1,
      mode,
      settings,
      distribution,
      sequence,
      candidates,
      stage,
      bpmInput,
      restProbInput,
      candidateKeyRoot,
      candidateBpm,
      candidateBpmInput,
      stageBpmInput,
    }
    writeComposerDraft(draft)
    setMelody(draft)
  }, [
    mode,
    settings,
    distribution,
    sequence,
    candidates,
    stage,
    bpmInput,
    restProbInput,
    candidateKeyRoot,
    candidateBpm,
    candidateBpmInput,
    stageBpmInput,
    setMelody,
  ])

  // Project key sync → local settings
  useEffect(() => {
    if (!projectDraft.keySync.melody) return
    setSettings((s) => {
      if (
        s.keyRoot === projectDraft.meta.keyRoot &&
        s.scale === projectDraft.meta.scale &&
        s.bpm === projectDraft.meta.bpm
      ) {
        return s
      }
      return {
        ...s,
        keyRoot: projectDraft.meta.keyRoot,
        scale: projectDraft.meta.scale,
        bpm: projectDraft.meta.bpm,
      }
    })
    setBpmInput(String(projectDraft.meta.bpm))
  }, [
    projectDraft.meta.keyRoot,
    projectDraft.meta.scale,
    projectDraft.meta.bpm,
    projectDraft.keySync.melody,
  ])

  useEffect(() => {
    const pending = takePendingAppend()
    if (!pending || pending.length === 0) return
    const draft = readComposerDraft()
    const base = draft?.stage ?? []
    const next = [...base, ...pending]
    writeStageDraft(next)
    setStage(next)
    if (base.length === 0 && pending[0]) {
      setStageBpmInput(String(pending[0].bpm))
    }
    setSaveFlash('譜面に追加しました')
    window.setTimeout(() => setSaveFlash(null), 2200)
  }, [])

  useEffect(() => {
    setScoreSaved(false)
  }, [stage])

  useEffect(() => {
    setFavoritedIds(new Set())
  }, [candidates])

  const resolveBpm = useCallback((): number => {
    const bpm = parsePositiveBpm(bpmInput, DEFAULT_BPM)
    setBpmInput(String(bpm))
    setSettings((s) => ({ ...s, bpm }))
    return bpm
  }, [bpmInput])

  const resolveRestProbability = useCallback((): number => {
    const trimmed = restProbInput.trim()
    const n = Number(trimmed)
    if (trimmed === '' || !Number.isFinite(n) || n < 0) {
      setRestProbInput(String(DEFAULT_REST_PROB))
      setSettings((s) => ({ ...s, restProbability: DEFAULT_REST_PROB }))
      return DEFAULT_REST_PROB
    }
    const restProbability = Math.min(100, Math.round(n))
    setRestProbInput(String(restProbability))
    setSettings((s) => ({ ...s, restProbability }))
    return restProbability
  }, [restProbInput])

  const onGenerate = useCallback(() => {
    const bpm = resolveBpm()
    const restProbability = resolveRestProbability()
    const next = generateCandidates(
      mode,
      { ...settings, bpm, restProbability },
      distribution,
      sequence,
    )
    setCandidates(next)
    setCandidateKeyRoot(settings.keyRoot)
    setCandidateBpm(bpm)
    setCandidateBpmInput(String(bpm))
  }, [
    mode,
    settings,
    distribution,
    sequence,
    resolveBpm,
    resolveRestProbability,
  ])

  const onCandidateKeyChange = useCallback((nextKey: number) => {
    setCandidates((prev) => {
      if (prev.length === 0) return prev
      const from = prev[0]!.keyRoot
      return transposePhrases(prev, from, nextKey)
    })
    setCandidateKeyRoot(nextKey)
  }, [])

  const commitCandidateBpm = useCallback(() => {
    const bpm = parsePositiveBpm(candidateBpmInput, candidateBpm)
    setCandidateBpmInput(String(bpm))
    setCandidateBpm(bpm)
    setCandidates((prev) =>
      prev.length === 0 ? prev : applyBpmToPhrases(prev, bpm),
    )
  }, [candidateBpmInput, candidateBpm])

  const onAdd = useCallback((phrase: Phrase) => {
    setStage((prev) => {
      if (prev.length === 0) {
        setStageBpmInput(String(phrase.bpm))
      }
      return [...prev, ...splitPhraseIntoBars(phrase)]
    })
  }, [])

  const onStageKeyChange = useCallback((nextKey: number) => {
    setStage((prev) =>
      prev.map((ph) => {
        const delta = keySemitoneDelta(ph.keyRoot, nextKey)
        return transposePhrase(ph, delta, nextKey)
      }),
    )
  }, [])

  const commitStageBpm = useCallback(() => {
    const fallback = stage[0]?.bpm ?? DEFAULT_BPM
    const bpm = parsePositiveBpm(stageBpmInput, fallback)
    setStageBpmInput(String(bpm))
    setStage((prev) =>
      prev.length === 0 ? prev : applyBpmToPhrases(prev, bpm),
    )
  }, [stageBpmInput, stage])

  const onPhraseKeyChange = useCallback(
    (phraseIndex: number, nextKey: number) => {
      setStage((prev) =>
        prev.map((ph, i) => {
          if (i !== phraseIndex) return ph
          const delta = keySemitoneDelta(ph.keyRoot, nextKey)
          return transposePhrase(ph, delta, nextKey)
        }),
      )
    },
    [],
  )

  const onPhraseBpmChange = useCallback((phraseIndex: number, bpm: number) => {
    setStage((prev) =>
      prev.map((ph, i) => (i === phraseIndex ? { ...ph, bpm } : ph)),
    )
    if (phraseIndex === 0) {
      setStageBpmInput(String(bpm))
    }
  }, [])

  const onChangePitch = useCallback(
    (phraseIndex: number, noteIndex: number, delta: number) => {
      setStage((prev) =>
        prev.map((ph, pi) => {
          if (pi !== phraseIndex) return ph
          return {
            ...ph,
            notes: ph.notes.map((n, ni) => {
              if (ni !== noteIndex || n.rest) return n
              return {
                ...n,
                pitch: Math.max(0, Math.min(127, n.pitch + delta)),
              }
            }),
          }
        }),
      )
    },
    [],
  )

  const onMove = useCallback((phraseIndex: number, dir: -1 | 1) => {
    setStage((prev) => {
      const next = [...prev]
      const j = phraseIndex + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[phraseIndex], next[j]] = [next[j]!, next[phraseIndex]!]
      return next
    })
    setSelected((sel) => {
      if (!sel) return sel
      if (sel.phraseIndex === phraseIndex) {
        return { ...sel, phraseIndex: phraseIndex + dir }
      }
      if (sel.phraseIndex === phraseIndex + dir) {
        return { ...sel, phraseIndex }
      }
      return sel
    })
  }, [])

  const onRemove = useCallback((phraseIndex: number) => {
    setStage((prev) => prev.filter((_, i) => i !== phraseIndex))
    setSelected((sel) => {
      if (!sel) return null
      if (sel.phraseIndex === phraseIndex) return null
      if (sel.phraseIndex > phraseIndex) {
        return { ...sel, phraseIndex: sel.phraseIndex - 1 }
      }
      return sel
    })
  }, [])

  const handlePlayAll = async () => {
    if (stage.length === 0) return
    await playPhrases(stage, undefined, 'melody', projectDraft.tones)
  }

  const handlePreview = async (phrase: Phrase) => {
    await playPhrase(phrase, undefined, projectDraft.tones)
  }

  const handleMidi = () => {
    if (stage.length === 0) return
    downloadMidi(stage, 'melody.mid', projectDraft.tones.melody)
  }

  const handleWav = async () => {
    if (stage.length === 0) return
    setExporting(true)
    try {
      await downloadWav(stage, 'melody.wav', projectDraft.tones.melody)
    } finally {
      setExporting(false)
    }
  }

  const onFavorite = useCallback((phrase: Phrase) => {
    if (favoritedIds.has(phrase.id)) return
    addFavorite(phrase)
    setFavoritedIds((prev) => new Set(prev).add(phrase.id))
    setSaveFlash('保存しました')
    window.setTimeout(() => setSaveFlash(null), 2200)
  }, [favoritedIds])

  const onClearCandidates = useCallback(() => {
    if (candidates.length === 0) return
    setClearConfirm('candidates')
  }, [candidates.length])

  const onClearStage = useCallback(() => {
    if (stage.length === 0) return
    setClearConfirm('stage')
  }, [stage.length])

  const cancelClearConfirm = useCallback(() => {
    setClearConfirm(null)
  }, [])

  const confirmClear = useCallback(() => {
    if (clearConfirm === 'candidates') {
      setCandidates([])
    } else if (clearConfirm === 'stage') {
      setStage([])
      setSelected(null)
    }
    setClearConfirm(null)
  }, [clearConfirm])

  const onSaveScore = useCallback(() => {
    if (stage.length === 0 || scoreSaved) return
    const suggested = defaultScoreName()
    const name = window.prompt('譜面の名前', suggested)
    if (name == null) return
    addScore(name, stage)
    setScoreSaved(true)
    setSaveFlash('保存しました')
    window.setTimeout(() => setSaveFlash(null), 2200)
  }, [stage, scoreSaved])

  const clearConfirmMessage =
    clearConfirm === 'candidates'
      ? `候補フレーズ（${candidates.length}件）をすべて削除しますか？この操作は取り消せません。`
      : clearConfirm === 'stage'
        ? `譜面（${stage.length}小節）をすべて削除しますか？この操作は取り消せません。`
        : ''

  return (
    <div className="app layer-page layer-page--melody">
      {arrangeSource && (
        <ArrangeModal
          title="メロディのちょいアレンジ"
          sourcePreview={<PhraseRoll phrase={arrangeSource} />}
          variants={arrangeVariants}
          onClose={() => setArrangeSource(null)}
          onRefresh={refreshArrange}
          onPreview={(v) => void handlePreview(v.phrase)}
          onAdd={(v) => {
            onAdd(v.phrase)
            setArrangeSource(null)
          }}
          renderVariant={(v) => <PhraseRoll phrase={v.phrase} />}
        />
      )}
      {clearConfirm && (
        <div
          className="app__confirm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-confirm-title"
        >
          <div className="app__confirm-panel">
            <h3 id="clear-confirm-title" className="app__confirm-title">
              一括削除の確認
            </h3>
            <p className="app__confirm-message">{clearConfirmMessage}</p>
            <div className="app__confirm-actions">
              <button
                type="button"
                className="btn"
                onClick={cancelClearConfirm}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={confirmClear}
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
      <header className="app__header">
        <h1>雰囲気メロディ</h1>
        <p className="app__lead">
          作曲が苦手でも、最大4小節までのフレーズを作って並べるだけでメロディになります。完成したら
          MIDI / WAV で書き出せます。設定・候補・譜面はこのブラウザに自動保存されます。
        </p>
        <KeySyncCheckbox layer="melody" />
        <ol className="app__steps">
          <li>
            <span className="app__step-num">1</span>
            キー・小節数・リズムなどを選んで「生成」
          </li>
          <li>
            <span className="app__step-num">2</span>
            候補を「聴く」→気に入ったら「譜面へ」
          </li>
          <li>
            <span className="app__step-num">3</span>
            譜面で並べ替え・音の高さ調整 → 再生 / 書き出し
          </li>
        </ol>
      </header>

      {saveFlash && <p className="app__flash">{saveFlash}</p>}

      <section className="app__section">
        <Controls
          mode={mode}
          settings={settings}
          bpmInput={bpmInput}
          onBpmInputChange={setBpmInput}
          restProbInput={restProbInput}
          onRestProbInputChange={setRestProbInput}
          distribution={distribution}
          sequence={sequence}
          onModeChange={setMode}
          onSettingsChange={(patch) => {
            setSettings((s) => {
              const next = { ...s, ...patch }
              if (typeof patch.barCount === 'number') {
                const max = maxCandidateCount(patch.barCount)
                if (next.candidateCount > max) {
                  next.candidateCount = max
                }
              }
              if (typeof patch.keyRoot === 'number') {
                setDistribution((d) => {
                  const centerMidi = centerMidiForKeyTonic(
                    patch.keyRoot!,
                    d.centerMidi,
                  )
                  if (d.activePreset === 'custom') {
                    return { ...d, centerMidi }
                  }
                  return {
                    ...d,
                    centerMidi,
                    weights: weightsFromPreset(
                      d.activePreset,
                      d.halfRange,
                      d.sigma,
                      {
                        excludeOutOfKey: d.excludeOutOfKey,
                        centerMidi,
                        keyRoot: patch.keyRoot!,
                        scale: next.scale,
                      },
                    ),
                  }
                })
              }
              return next
            })
            if (projectDraft.keySync.melody) {
              const metaPatch: {
                keyRoot?: number
                scale?: typeof settings.scale
                bpm?: number
              } = {}
              if (typeof patch.keyRoot === 'number') metaPatch.keyRoot = patch.keyRoot
              if (patch.scale) metaPatch.scale = patch.scale
              if (typeof patch.bpm === 'number') metaPatch.bpm = patch.bpm
              if (Object.keys(metaPatch).length) setMeta(metaPatch)
            }
          }}
          onDistributionChange={(patch) =>
            setDistribution((d) => ({ ...d, ...patch }))
          }
          onSequenceChange={(patch) =>
            setSequence((s) => ({ ...s, ...patch }))
          }
          onGenerate={onGenerate}
        />
      </section>

      <section className="app__section">
        <div className="app__section-head app__section-head--plain">
          <h2>
            候補フレーズ
            <span className="app__section-meta">{settings.barCount}小節</span>
          </h2>
          <div className="app__section-head-actions">
            <Link to="/library/favorites" className="app__section-link">
              お気に入りへ
            </Link>
            <button
              type="button"
              className="btn btn--danger"
              onClick={onClearCandidates}
              disabled={candidates.length === 0}
            >
              一括削除
            </button>
          </div>
        </div>
        <SectionTuneBar
          keyRoot={candidateKeyRoot}
          bpmInput={candidateBpmInput}
          disabled={candidates.length === 0}
          onKeyChange={onCandidateKeyChange}
          onBpmInputChange={setCandidateBpmInput}
          onBpmCommit={commitCandidateBpm}
        />
        {candidates.length === 0 && (
          <p className="app__section-lead">
            「生成」の結果がここに出ます。聴いて選んで、譜面へ追加しましょう。
          </p>
        )}
        <CandidatePool
          candidates={candidates}
          favoritedIds={favoritedIds}
          onPreview={handlePreview}
          onAdd={onAdd}
          onFavorite={onFavorite}
          onArrange={openArrange}
        />
      </section>

      <section className="app__section app__section--score">
        <div className="app__section-head">
          <div>
            <h2>譜面</h2>
            {stage.length === 0 && (
              <p className="app__section-lead app__section-lead--score">
                選んだフレーズを並べてメロディにします。再生・MIDI・WAV
                はここから。
              </p>
            )}
          </div>
          <div className="app__score-actions">
            <div className="app__score-actions-row">
              <PlayStopButton
                label="譜面を再生"
                className="btn btn--score"
                disabled={stage.length === 0}
                onPlay={() => void handlePlayAll()}
              />
              <button
                type="button"
                className={`btn${scoreSaved ? ' btn--saved' : ''}`}
                onClick={onSaveScore}
                disabled={stage.length === 0 || scoreSaved}
              >
                {scoreSaved ? '保存済' : '譜面を保存'}
              </button>
              <Link to="/library/scores" className="app__section-link app__section-link--score">
                保存した譜面へ
              </Link>
              <button
                type="button"
                className="btn btn--danger"
                onClick={onClearStage}
                disabled={stage.length === 0}
              >
                一括削除
              </button>
            </div>
            <div className="app__score-actions-row">
              <button
                type="button"
                className="btn"
                onClick={handleMidi}
                disabled={stage.length === 0 || exporting}
              >
                MIDIをダウンロード
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleWav}
                disabled={stage.length === 0 || exporting}
              >
                {exporting ? 'WAV生成中…' : 'WAVをダウンロード'}
              </button>
            </div>
          </div>
        </div>
        <SectionTuneBar
          variant="score"
          keyLabel="全体キー"
          bpmLabel="全体BPM"
          keyRoot={stage[0]?.keyRoot ?? settings.keyRoot}
          bpmInput={stageBpmInput}
          disabled={stage.length === 0}
          onKeyChange={onStageKeyChange}
          onBpmInputChange={setStageBpmInput}
          onBpmCommit={commitStageBpm}
        />
        <Stage
          phrases={stage}
          selected={selected}
          onSelect={(pi, ni) => setSelected({ phraseIndex: pi, noteIndex: ni })}
          onChangePitch={onChangePitch}
          onRemove={onRemove}
          onMove={onMove}
          onPhraseKeyChange={onPhraseKeyChange}
          onPhraseBpmChange={onPhraseBpmChange}
          sectionLabels={labelsForPhrases(projectDraft.sections, stage)}
          onPlayPhrase={(pi) => {
            const phrase = stage[pi]
            if (phrase) void handlePreview(phrase)
          }}
        />
      </section>
      <AppFooter />
    </div>
  )
}

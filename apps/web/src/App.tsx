import { useCallback, useState } from 'react'
import { playPhrase, playPhrases, stopPlayback } from './audio/player'
import { CandidatePool } from './components/CandidatePool'
import { Controls } from './components/Controls'
import { SectionTuneBar } from './components/SectionTuneBar'
import { Stage } from './components/Stage'
import { generateCandidates, maxCandidateCount } from './core/generators'
import { splitPhraseIntoBars } from './core/phraseSplit'
import {
  applyBpmToPhrases,
  transposePhrase,
  transposePhrases,
} from './core/transpose'
import {
  centerMidiForKeyTonic,
  weightsFromPreset,
} from './core/distributionWeights'
import { createDefaultDistribution, createDefaultSequence } from './core/types'
import type { GenMode, Phrase, ProjectSettings } from './core/types'
import { downloadMidi } from './export/midi'
import { downloadWav } from './export/wav'
import './App.css'

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

export default function App() {
  const [mode, setMode] = useState<GenMode>('distribution')
  const [settings, setSettings] = useState<ProjectSettings>(() => ({
    ...initialSettingsBase,
    candidateCount: defaultCandidateCount(),
  }))
  const [distribution, setDistribution] = useState(() =>
    createDefaultDistribution(
      initialSettingsBase.keyRoot,
      initialSettingsBase.octave,
      initialSettingsBase.scale,
    ),
  )
  const [sequence, setSequence] = useState(createDefaultSequence)
  const [candidates, setCandidates] = useState<Phrase[]>([])
  const [stage, setStage] = useState<Phrase[]>([])
  const [selected, setSelected] = useState<{
    phraseIndex: number
    noteIndex: number
  } | null>(null)
  const [playing, setPlaying] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [bpmInput, setBpmInput] = useState(String(DEFAULT_BPM))
  const [restProbInput, setRestProbInput] = useState(
    String(DEFAULT_REST_PROB),
  )

  const [candidateKeyRoot, setCandidateKeyRoot] = useState(
    initialSettingsBase.keyRoot,
  )
  const [candidateBpm, setCandidateBpm] = useState(DEFAULT_BPM)
  const [candidateBpmInput, setCandidateBpmInput] = useState(
    String(DEFAULT_BPM),
  )

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
    setStage((prev) => [...prev, ...splitPhraseIntoBars(phrase)])
  }, [])

  const onPhraseKeyChange = useCallback(
    (phraseIndex: number, nextKey: number) => {
      setStage((prev) =>
        prev.map((ph, i) => {
          if (i !== phraseIndex) return ph
          const delta = ((nextKey - ph.keyRoot) % 12 + 12) % 12
          const signed = delta > 6 ? delta - 12 : delta
          return transposePhrase(ph, signed, nextKey)
        }),
      )
    },
    [],
  )

  const onPhraseBpmChange = useCallback((phraseIndex: number, bpm: number) => {
    setStage((prev) =>
      prev.map((ph, i) => (i === phraseIndex ? { ...ph, bpm } : ph)),
    )
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
    setPlaying(true)
    await playPhrases(stage, () => setPlaying(false))
  }

  const handlePreview = async (phrase: Phrase) => {
    setPlaying(true)
    await playPhrase(phrase, () => setPlaying(false))
  }

  const handleStop = async () => {
    await stopPlayback()
    setPlaying(false)
  }

  const handleMidi = () => {
    if (stage.length === 0) return
    downloadMidi(stage)
  }

  const handleWav = async () => {
    if (stage.length === 0) return
    setExporting(true)
    try {
      await downloadWav(stage)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="app">
      <header className="app__header">
        <p className="app__brand">Mathematical Music</p>
        <h1>メロディ組み立て</h1>
        <p className="app__lead">
          作曲が苦手でも、最大4小節までのフレーズを作って並べるだけでメロディになります。完成したら
          MIDI / WAV で書き出せます。
        </p>
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
        <h2>
          候補フレーズ
          <span className="app__section-meta">{settings.barCount}小節</span>
        </h2>
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
          onPreview={handlePreview}
          onAdd={onAdd}
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
            {playing ? (
              <button type="button" className="btn" onClick={handleStop}>
                停止
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--score"
                onClick={handlePlayAll}
                disabled={stage.length === 0}
              >
                譜面を再生
              </button>
            )}
            <button
              type="button"
              className="btn"
              onClick={handleMidi}
              disabled={stage.length === 0 || exporting}
            >
              MIDI
            </button>
            <button
              type="button"
              className="btn"
              onClick={handleWav}
              disabled={stage.length === 0 || exporting}
            >
              {exporting ? 'WAV生成中…' : 'WAV'}
            </button>
          </div>
        </div>
        <Stage
          phrases={stage}
          selected={selected}
          onSelect={(pi, ni) => setSelected({ phraseIndex: pi, noteIndex: ni })}
          onChangePitch={onChangePitch}
          onRemove={onRemove}
          onMove={onMove}
          onPhraseKeyChange={onPhraseKeyChange}
          onPhraseBpmChange={onPhraseBpmChange}
          onPlayPhrase={(pi) => {
            const phrase = stage[pi]
            if (phrase) void handlePreview(phrase)
          }}
        />
      </section>
    </div>
  )
}

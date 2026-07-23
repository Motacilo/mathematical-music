import { useCallback, useState } from 'react'
import { playPhrase, playPhrases, stopPlayback } from './audio/player'
import { CandidatePool } from './components/CandidatePool'
import { Controls } from './components/Controls'
import { Stage } from './components/Stage'
import { generateCandidates } from './core/generators'
import {
  centerMidiForKeyTonic,
  weightsFromPreset,
} from './core/distributionWeights'
import { createDefaultDistribution, createDefaultSequence } from './core/types'
import type {
  GenMode,
  Phrase,
  ProjectSettings,
} from './core/types'
import { downloadMidi } from './export/midi'
import { downloadWav } from './export/wav'
import './App.css'

const DEFAULT_BPM = 160
const DEFAULT_REST_PROB = 0

const initialSettings: ProjectSettings = {
  keyRoot: 0,
  scale: 'major',
  bpm: DEFAULT_BPM,
  octave: 4,
  rhythmId: 'eighths',
  candidateCount: 8,
  restProbability: DEFAULT_REST_PROB,
}

function clonePhrase(phrase: Phrase): Phrase {
  return {
    ...phrase,
    id: `ph_${Math.random().toString(36).slice(2, 10)}`,
    notes: phrase.notes.map((n) => ({ ...n })),
  }
}

export default function App() {
  const [mode, setMode] = useState<GenMode>('distribution')
  const [settings, setSettings] = useState<ProjectSettings>(initialSettings)
  const [distribution, setDistribution] = useState(() =>
    createDefaultDistribution(
      initialSettings.keyRoot,
      initialSettings.octave,
      initialSettings.scale,
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

  const resolveBpm = useCallback((): number => {
    const trimmed = bpmInput.trim()
    const n = Number(trimmed)
    if (trimmed === '' || !Number.isFinite(n) || n <= 0) {
      setBpmInput(String(DEFAULT_BPM))
      setSettings((s) => ({ ...s, bpm: DEFAULT_BPM }))
      return DEFAULT_BPM
    }
    const bpm = Math.round(n)
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
    setCandidates(
      generateCandidates(
        mode,
        { ...settings, bpm, restProbability },
        distribution,
        sequence,
      ),
    )
  }, [
    mode,
    settings,
    distribution,
    sequence,
    resolveBpm,
    resolveRestProbability,
  ])

  const onAdd = useCallback((phrase: Phrase) => {
    setStage((prev) => [...prev, clonePhrase(phrase)])
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
              // Chromatic step so out-of-key notes stay editable
              return { ...n, pitch: n.pitch + delta }
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
    await playPhrases(stage, settings.bpm, () => setPlaying(false))
  }

  const handlePreview = async (phrase: Phrase) => {
    setPlaying(true)
    await playPhrase(phrase, phrase.bpm, () => setPlaying(false))
  }

  const handleStop = async () => {
    await stopPlayback()
    setPlaying(false)
  }

  const handleMidi = () => {
    if (stage.length === 0) return
    downloadMidi(stage, settings.bpm)
  }

  const handleWav = async () => {
    if (stage.length === 0) return
    setExporting(true)
    try {
      await downloadWav(stage, settings.bpm)
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
          1小節フレーズを生成し、譜面に並べてメロディをつくります。MIDI / WAV
          で書き出せます。
        </p>
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
          {candidates.length > 0 && (
            <span className="app__section-meta">
              BPM {candidates[0]!.bpm}
            </span>
          )}
        </h2>
        <CandidatePool
          candidates={candidates}
          onPreview={handlePreview}
          onAdd={onAdd}
        />
      </section>

      <section className="app__section app__section--score">
        <div className="app__section-head">
          <h2>譜面</h2>
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
        />
      </section>
    </div>
  )
}

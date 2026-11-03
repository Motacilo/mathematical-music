import { playDrumPhrase, playLayers } from '../audio/player'
import { PlayStopButton } from '../components/PlayStopButton'
import {
  DRUM_ARRANGE_OPTIONS,
  DRUM_STYLE_OPTIONS,
  generateDrumCandidates,
} from '../core/drums/generate'
import { uid } from '../core/chords/theory'
import { useProject } from '../core/ProjectContext'
import { labelsForPhrases } from '../core/sections/timeline'
import type {
  DrumArrangeMode,
  DrumHit,
  DrumPhrase,
  DrumStyleSelect,
} from '../core/projectTypes'
import '../pages/ComposerPage.css'
import '../components/CandidatePool.css'
import '../components/Stage.css'
import './LayerPages.css'

function hitsSummary(hits: DrumHit[]): string {
  const counts = { kick: 0, snare: 0, hat: 0 }
  for (const h of hits) counts[h.instrument]++
  return `K${counts.kick} · S${counts.snare} · H${counts.hat}`
}

function phraseTitle(ph: DrumPhrase, index: number, prefix: string): string {
  const style = ph.label ?? 'リズム'
  return `${prefix} ${index + 1} · ${style} · ${ph.bars}小節`
}

function DrumPreview({ phrase }: { phrase: DrumPhrase }) {
  const maxBeat = Math.max(1, phrase.bars * 4)
  return (
    <div className="drum-preview" aria-hidden>
      {(['kick', 'snare', 'hat'] as const).map((inst) => (
        <div key={inst} className="drum-preview__row">
          <span className="drum-preview__label">{inst}</span>
          <div className="drum-preview__lane">
            {phrase.hits
              .filter((h) => h.instrument === inst)
              .map((h, i) => (
                <span
                  key={i}
                  className={`drum-preview__hit drum-preview__hit--${inst}`}
                  style={{ left: `${(h.beat / maxBeat) * 100}%` }}
                />
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function DrumsPage() {
  const { draft, setDrums } = useProject()
  const drums = draft.drums
  const bpm = draft.meta.bpm
  const styleId = drums.styleId ?? 'any'
  const arrangeMode = drums.arrangeMode ?? 'mixed'

  const generate = () => {
    const cands = generateDrumCandidates(
      drums.candidateCount,
      drums.barCount,
      bpm,
      drums.density,
      styleId,
      arrangeMode,
    )
    setDrums({ ...drums, candidates: cands })
  }

  const playAllStage = async () => {
    if (drums.stage.length === 0) return
    await playLayers(
      { drums: drums.stage },
      {
        volume: { melody: 0, chords: 0, bass: 0, drums: 0.85 },
        mute: { melody: true, chords: true, bass: true, drums: false },
        solo: { melody: false, chords: false, bass: false, drums: false },
      },
    )
  }

  return (
    <div className="app layer-page layer-page--drums">
      <header className="app__header">
        <h1>雰囲気リズム</h1>
        <p className="app__lead">
          4つ打ち・エイトビートなどの定番パターンと、少し音を足したちょいアレンジを候補に出せます。
        </p>
      </header>

      <section className="app__section">
        <div className="layer-controls">
          <label>
            パターン
            <select
              value={styleId}
              onChange={(e) =>
                setDrums({
                  ...drums,
                  styleId: e.target.value as DrumStyleSelect,
                })
              }
            >
              {DRUM_STYLE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            アレンジ
            <select
              value={arrangeMode}
              onChange={(e) =>
                setDrums({
                  ...drums,
                  arrangeMode: e.target.value as DrumArrangeMode,
                })
              }
            >
              {DRUM_ARRANGE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            小節数
            <select
              value={drums.barCount}
              onChange={(e) =>
                setDrums({ ...drums, barCount: Number(e.target.value) })
              }
            >
              {[1, 2, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            アレンジ強さ {drums.density}
            <input
              type="range"
              min={0}
              max={100}
              value={drums.density}
              onChange={(e) =>
                setDrums({ ...drums, density: Number(e.target.value) })
              }
              disabled={arrangeMode === 'clean'}
            />
          </label>
          <label>
            候補数
            <select
              value={Math.min(8, Math.max(4, drums.candidateCount || 6))}
              onChange={(e) =>
                setDrums({
                  ...drums,
                  candidateCount: Number(e.target.value),
                })
              }
            >
              {[4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn primary" onClick={generate}>
            生成
          </button>
        </div>
        <p className="layer-hint">
          「定番そのまま」は教科書どおりの型、「ちょいアレンジ」はキックやハットを少し足した変奏です。「混在」だと候補に両方が並びます。
        </p>
      </section>

      <section className="app__section">
        <div className="app__section-head app__section-head--plain">
          <h2>候補</h2>
        </div>
        {drums.candidates.length === 0 ? (
          <div className="candidate-pool-wrap">
            <div className="candidate-pool candidate-pool--empty">
              <p className="candidate-pool__empty-title">まだ候補がありません</p>
              <p>
                パターンとアレンジを選んで「生成」を押すと、リズム候補がここに並びます。
              </p>
            </div>
          </div>
        ) : (
          <div className="candidate-pool-wrap">
            <div className="candidate-pool">
              {drums.candidates.map((ph, i) => (
                <article key={ph.id} className="candidate-card">
                  <header className="candidate-card__head">
                    <span className="candidate-card__label">
                      {phraseTitle(ph, i, '候補')}
                    </span>
                    <div className="candidate-card__actions">
                      <PlayStopButton
                        label="聴く"
                        onPlay={() => {
                          void playDrumPhrase(ph)
                        }}
                      />
                      <button
                        type="button"
                        className="primary"
                        onClick={() =>
                          setDrums({
                            ...drums,
                            stage: [
                              ...drums.stage,
                              {
                                ...ph,
                                id: uid('drm'),
                                hits: ph.hits.map((h) => ({ ...h })),
                              },
                            ],
                          })
                        }
                      >
                        譜面へ
                      </button>
                    </div>
                  </header>
                  <p className="layer-card-seq">{hitsSummary(ph.hits)}</p>
                  <DrumPreview phrase={ph} />
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="app__section app__section--score">
        <div className="app__section-head">
          <h2>リズム譜面</h2>
          <div className="app__score-actions-row">
            <PlayStopButton
              label="譜面を再生"
              className="btn btn--score"
              disabled={drums.stage.length === 0}
              onPlay={() => void playAllStage()}
            />
            <button
              type="button"
              className="btn btn--danger"
              disabled={drums.stage.length === 0}
              onClick={() => setDrums({ ...drums, stage: [] })}
            >
              一括削除
            </button>
          </div>
        </div>
        {drums.stage.length === 0 ? (
          <div className="stage-wrap">
            <div className="stage stage--empty">
              <p className="stage__empty-title">まだ譜面が空です</p>
              <p>候補の「譜面へ」でパターンを続けて追加できます。</p>
            </div>
          </div>
        ) : (
          <div className="stage-wrap">
            <ul className="stage__list">
              {drums.stage.map((ph, i) => (
                <li key={ph.id} className="stage__item">
                  <div className="stage__item-meta">
                    <span className="stage__item-title">
                      {phraseTitle(ph, i, 'ブロック')}
                      {labelsForPhrases(draft.sections, drums.stage)[i] && (
                        <span className="stage__section-tag">
                          {labelsForPhrases(draft.sections, drums.stage)[i]}
                        </span>
                      )}
                    </span>
                    <div className="stage__item-actions">
                      <PlayStopButton
                        label="聴く"
                        onPlay={() => {
                          void playDrumPhrase(ph)
                        }}
                      />
                      <button
                        type="button"
                        className="danger"
                        onClick={() =>
                          setDrums({
                            ...drums,
                            stage: drums.stage.filter((x) => x.id !== ph.id),
                          })
                        }
                      >
                        削除
                      </button>
                    </div>
                  </div>
                  <p className="layer-card-seq">{hitsSummary(ph.hits)}</p>
                  <DrumPreview phrase={ph} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}

import { useState } from 'react'
import { playDrumPhrase, playLayers, stopPlayback } from '../audio/player'
import { generateDrumCandidates } from '../core/drums/generate'
import { uid } from '../core/chords/theory'
import { useProject } from '../core/ProjectContext'
import type { DrumHit, DrumPhrase } from '../core/projectTypes'
import '../pages/ComposerPage.css'
import '../components/CandidatePool.css'
import '../components/Stage.css'
import './LayerPages.css'

function hitsSummary(hits: DrumHit[]): string {
  const counts = { kick: 0, snare: 0, hat: 0 }
  for (const h of hits) counts[h.instrument]++
  return `K${counts.kick} · S${counts.snare} · H${counts.hat}`
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
  const [playing, setPlaying] = useState(false)

  const generate = () => {
    const cands = generateDrumCandidates(
      drums.candidateCount,
      drums.barCount,
      bpm,
      drums.density,
    )
    setDrums({ ...drums, candidates: cands })
  }

  const playAllStage = async () => {
    if (drums.stage.length === 0) return
    setPlaying(true)
    await playLayers(
      { drums: drums.stage },
      {
        volume: { melody: 0, chords: 0, bass: 0, drums: 0.85 },
        mute: { melody: true, chords: true, bass: true, drums: false },
        solo: { melody: false, chords: false, bass: false, drums: false },
      },
      () => setPlaying(false),
    )
  }

  return (
    <div className="app layer-page layer-page--drums">
      <header className="app__header">
        <h1>雰囲気リズム</h1>
        <p className="app__lead">
          Kick / Snare / HiHat のパターン候補です。音階や数列はありません。密度で疎密を調整できます。
        </p>
      </header>

      <section className="app__section">
        <div className="layer-controls">
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
            密度 {drums.density}
            <input
              type="range"
              min={0}
              max={100}
              value={drums.density}
              onChange={(e) =>
                setDrums({ ...drums, density: Number(e.target.value) })
              }
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
          {playing && (
            <button
              type="button"
              className="btn"
              onClick={() => void stopPlayback().then(() => setPlaying(false))}
            >
              停止
            </button>
          )}
        </div>
      </section>

      <section className="app__section">
        <div className="app__section-head app__section-head--plain">
          <h2>候補</h2>
        </div>
        {drums.candidates.length === 0 ? (
          <div className="candidate-pool-wrap">
            <div className="candidate-pool candidate-pool--empty">
              <p className="candidate-pool__empty-title">まだ候補がありません</p>
              <p>小節数と密度を選んで「生成」を押すと、リズム候補がここに並びます。</p>
            </div>
          </div>
        ) : (
          <div className="candidate-pool-wrap">
            <div className="candidate-pool">
              {drums.candidates.map((ph, i) => (
                <article key={ph.id} className="candidate-card">
                  <header className="candidate-card__head">
                    <span className="candidate-card__label">
                      候補 {i + 1} · {ph.bars}小節
                    </span>
                    <div className="candidate-card__actions">
                      <button
                        type="button"
                        onClick={() => {
                          setPlaying(true)
                          void playDrumPhrase(ph, () => setPlaying(false))
                        }}
                      >
                        聴く
                      </button>
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
            <button
              type="button"
              className="btn btn--score"
              disabled={drums.stage.length === 0}
              onClick={() => void playAllStage()}
            >
              譜面を再生
            </button>
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
                      ブロック {i + 1} · {ph.bars}小節
                    </span>
                    <div className="stage__item-actions">
                      <button
                        type="button"
                        onClick={() => {
                          setPlaying(true)
                          void playDrumPhrase(ph, () => setPlaying(false))
                        }}
                      >
                        聴く
                      </button>
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

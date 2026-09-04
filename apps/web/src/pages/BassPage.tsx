import { useState } from 'react'
import { playPhrases, stopPlayback } from '../audio/player'
import { KeySyncCheckbox } from '../components/KeySyncCheckbox'
import { PhraseRoll } from '../components/PhraseRoll'
import { generateBassCandidates } from '../core/bass/generate'
import { uid } from '../core/chords/theory'
import { useProject } from '../core/ProjectContext'
import { RHYTHM_LABELS } from '../core/rhythm'
import { splitPhraseIntoBars } from '../core/phraseSplit'
import type { RhythmId } from '../core/types'
import '../pages/ComposerPage.css'
import '../components/CandidatePool.css'
import '../components/Stage.css'
import './LayerPages.css'

const BASS_RHYTHMS: RhythmId[] = [
  'quarters',
  'eighths',
  'mixed_8_4',
]

export default function BassPage() {
  const { draft, setBass, effectiveKey } = useProject()
  const bass = draft.bass
  const { keyRoot, scale } = effectiveKey('bass')
  const bpm = draft.meta.bpm
  const [playing, setPlaying] = useState(false)

  const generate = () => {
    if (bass.mode === 'follow' && draft.chords.stage.length === 0) {
      window.alert(
        'コード譜面が空です。コードタブで進行を作るか、モードを「ランダム」にしてください。',
      )
      return
    }
    const cands = generateBassCandidates(
      bass.mode,
      bass.candidateCount,
      draft.chords.stage,
      bass.barCount,
      keyRoot,
      scale,
      bpm,
      bass.rhythmId,
      bass.octave,
    )
    setBass({ ...bass, candidates: cands })
  }

  const addToStage = (ph: (typeof bass.candidates)[0]) => {
    const bars = splitPhraseIntoBars(ph).map((b) => ({
      ...b,
      id: uid('bass'),
    }))
    setBass({
      ...bass,
      stage: [...bass.stage, ...bars],
    })
  }

  return (
    <div className="app layer-page layer-page--bass">
      <header className="app__header">
        <h1>雰囲気ベース</h1>
        <p className="app__lead">
          コード追従（ルート／5度／歩行）か、キー内のランダム低音から候補を出します。追加する小節数を選べます。
        </p>
        <KeySyncCheckbox layer="bass" />
      </header>

      <section className="app__section">
        <div className="layer-controls">
          <label>
            モード
            <select
              value={bass.mode}
              onChange={(e) =>
                setBass({
                  ...bass,
                  mode: e.target.value as typeof bass.mode,
                })
              }
            >
              <option value="follow">コード追従</option>
              <option value="random">ランダム</option>
            </select>
          </label>
          <label>
            リズム
            <select
              value={bass.rhythmId}
              onChange={(e) =>
                setBass({
                  ...bass,
                  rhythmId: e.target.value as RhythmId,
                })
              }
            >
              {BASS_RHYTHMS.map((id) => (
                <option key={id} value={id}>
                  {RHYTHM_LABELS[id]}
                </option>
              ))}
            </select>
          </label>
          <label>
            オクターブ
            <select
              value={bass.octave}
              onChange={(e) =>
                setBass({ ...bass, octave: Number(e.target.value) })
              }
            >
              {[2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            小節数
            <select
              value={bass.barCount}
              onChange={(e) =>
                setBass({ ...bass, barCount: Number(e.target.value) })
              }
            >
              {[1, 2, 3, 4, 8].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            候補数
            <select
              value={Math.min(8, Math.max(4, bass.candidateCount || 6))}
              onChange={(e) =>
                setBass({
                  ...bass,
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
        {bass.mode === 'follow' && (
          <p className="layer-hint">
            コード譜面から先頭（またはループ）で {bass.barCount}{' '}
            小節分のベースを生成します（現在コード{' '}
            {draft.chords.stage.length} 小節）。
          </p>
        )}
      </section>

      <section className="app__section">
        <div className="app__section-head app__section-head--plain">
          <h2>候補</h2>
        </div>
        {bass.candidates.length === 0 ? (
          <div className="candidate-pool-wrap">
            <div className="candidate-pool candidate-pool--empty">
              <p className="candidate-pool__empty-title">まだ候補がありません</p>
              <p>小節数などを選んで「生成」を押すと、ベース候補がここに並びます。</p>
            </div>
          </div>
        ) : (
          <div className="candidate-pool-wrap">
            <div className="candidate-pool">
              {bass.candidates.map((ph, i) => (
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
                          void playPhrases([ph], () => setPlaying(false), 'bass')
                        }}
                      >
                        聴く
                      </button>
                      <button
                        type="button"
                        className="primary"
                        onClick={() => addToStage(ph)}
                      >
                        譜面へ
                      </button>
                    </div>
                  </header>
                  <PhraseRoll phrase={ph} />
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="app__section app__section--score">
        <div className="app__section-head">
          <h2>ベース譜面</h2>
          <div className="app__score-actions-row">
            <button
              type="button"
              className="btn btn--score"
              disabled={bass.stage.length === 0}
              onClick={() => {
                setPlaying(true)
                void playPhrases(bass.stage, () => setPlaying(false), 'bass')
              }}
            >
              譜面を再生
            </button>
            <button
              type="button"
              className="btn btn--danger"
              disabled={bass.stage.length === 0}
              onClick={() => setBass({ ...bass, stage: [] })}
            >
              一括削除
            </button>
          </div>
        </div>
        {bass.stage.length === 0 ? (
          <div className="stage-wrap">
            <div className="stage stage--empty">
              <p className="stage__empty-title">まだ譜面が空です</p>
              <p>候補の「譜面へ」で小節ごとに追加されます。</p>
            </div>
          </div>
        ) : (
          <div className="stage-wrap">
            <ul className="stage__list">
              {bass.stage.map((ph, i) => (
                <li key={ph.id} className="stage__item">
                  <div className="stage__item-meta">
                    <span className="stage__item-title">小節 {i + 1}</span>
                    <div className="stage__item-actions">
                      <button
                        type="button"
                        onClick={() => {
                          setPlaying(true)
                          void playPhrases(
                            [ph],
                            () => setPlaying(false),
                            'bass',
                          )
                        }}
                      >
                        聴く
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() =>
                          setBass({
                            ...bass,
                            stage: bass.stage.filter((x) => x.id !== ph.id),
                          })
                        }
                      >
                        削除
                      </button>
                    </div>
                  </div>
                  <PhraseRoll phrase={ph} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}

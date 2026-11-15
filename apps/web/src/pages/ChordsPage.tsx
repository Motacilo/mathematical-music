import { useState } from 'react'
import { playChordProgression } from '../audio/player'
import { PlayStopButton } from '../components/PlayStopButton'
import { ArrangeModal } from '../components/ArrangeModal'
import { KeySyncCheckbox } from '../components/KeySyncCheckbox'
import {
  generateChordArrangeVariants,
  type ChordArrangeVariant,
} from '../core/arrange/variants'
import {
  appendChordRoot,
  generateCandidateProgressions,
  progressionFromPreset,
  qualityForFreeAdd,
} from '../core/chords/generate'
import {
  CHORD_ROOT_DEFS,
  createDefaultRootEnable,
  type ChordRootId,
  type RootEnableMap,
} from '../core/chords/roots'
import {
  chordSymbolName,
  chordTonesLine,
  makeChordBarFromRoot,
  uid,
} from '../core/chords/theory'
import { presetsForScale } from '../core/chords/transitions'
import { useProject } from '../core/ProjectContext'
import { sectionLabelAt } from '../core/sections/timeline'
import { CHORD_PLAY_STYLE_OPTIONS } from '../core/chords/playStyle'
import {
  ALL_CHORD_QUALITIES,
  CHORD_QUALITY_LABELS,
  type ChordBar,
  type ChordNoteLabelMode,
  type ChordPlayStyleId,
  type QualityEnableMap,
} from '../core/projectTypes'
import { KEY_NAMES, keyOptionLabel } from '../core/scale'
import '../pages/ComposerPage.css'
import '../components/CandidatePool.css'
import '../components/Stage.css'
import './LayerPages.css'

function cloneProg(prog: ChordBar[]): ChordBar[] {
  return prog.map((c) => ({ ...c, id: uid('ch') }))
}

function ChordProgPreview({
  prog,
  labelMode,
}: {
  prog: ChordBar[]
  labelMode: ChordNoteLabelMode
}) {
  return (
    <>
      <p className="layer-card-seq">
        {prog.map((c) => chordSymbolName(c)).join(' → ')}
      </p>
      <p className="layer-card-tones">
        {prog.map((c) => chordTonesLine(c, labelMode)).join(' ｜ ')}
      </p>
    </>
  )
}

function QualityChecks({
  title,
  hint,
  map,
  onChange,
}: {
  title: string
  hint: string
  map: QualityEnableMap
  onChange: (next: QualityEnableMap) => void
}) {
  return (
    <div className="quality-box">
      <p className="quality-box__title">{title}</p>
      <p className="layer-hint">{hint}</p>
      <div className="quality-box__grid">
        {ALL_CHORD_QUALITIES.map((q) => (
          <label key={q} className="quality-box__item">
            <input
              type="checkbox"
              checked={map[q]}
              onChange={(e) => onChange({ ...map, [q]: e.target.checked })}
            />
            {CHORD_QUALITY_LABELS[q]}
          </label>
        ))}
      </div>
    </div>
  )
}

function RootChecks({
  map,
  onChange,
}: {
  map: RootEnableMap
  onChange: (next: RootEnableMap) => void
}) {
  return (
    <div className="quality-box">
      <p className="quality-box__title">出すルート（I〜VII ＋ 半音／キー外）</p>
      <p className="layer-hint">
        オンのルートだけが生成・自由追加の候補になります。♭II や ♯IV
        などキー外も選べます。
      </p>
      <div className="quality-box__grid">
        {CHORD_ROOT_DEFS.map((def) => (
          <label key={def.id} className="quality-box__item">
            <input
              type="checkbox"
              checked={map[def.id]}
              onChange={(e) =>
                onChange({ ...map, [def.id]: e.target.checked })
              }
            />
            {def.label}
            {(def.inMajor || def.inMinor) && (
              <span className="root-tag">
                {def.inMajor && def.inMinor
                  ? 'ダイアトニック'
                  : def.inMajor
                    ? 'Maj'
                    : 'Min'}
              </span>
            )}
          </label>
        ))}
      </div>
    </div>
  )
}

export default function ChordsPage() {
  const { draft, setChords, setKeySync, effectiveKey } = useProject()
  const chords = draft.chords
  const { keyRoot, scale } = effectiveKey('chords')
  const bpm = draft.meta.bpm
  const [arrangeSource, setArrangeSource] = useState<ChordBar[] | null>(null)
  const [arrangeVariants, setArrangeVariants] = useState<ChordArrangeVariant[]>(
    [],
  )
  const labelMode = chords.noteLabelMode ?? 'letter'
  const projectKeyLabel = `${keyOptionLabel(draft.meta.keyRoot)} / ${
    draft.meta.scale === 'major' ? 'メジャー' : 'マイナー'
  }`

  const openArrange = (prog: ChordBar[]) => {
    setArrangeSource(prog)
    setArrangeVariants(generateChordArrangeVariants(prog, 5))
  }

  const setChordKey = (nextKey: number, nextScale: typeof scale) => {
    const syncOff =
      nextKey !== draft.meta.keyRoot || nextScale !== draft.meta.scale
    if (syncOff && draft.keySync.chords) {
      setKeySync({ chords: false })
    }
    setChords({
      ...chords,
      keyRoot: nextKey,
      scale: nextScale,
      rootEnable:
        nextScale !== scale
          ? createDefaultRootEnable(nextScale)
          : chords.rootEnable,
    })
  }

  const generate = () => {
    if (chords.mode === 'free') return
    const cands = generateCandidateProgressions(
      chords.mode === 'random' ? 'random' : 'markov',
      chords.candidateCount,
      chords.barCount,
      keyRoot,
      scale,
      bpm,
      chords.qualityEnable,
      chords.rootEnable,
    )
    setChords({ ...chords, candidates: cands })
  }

  const listen = async (prog: ChordBar[]) => {
    await playChordProgression(
      prog,
      undefined,
      chords.playStyle ?? 'block',
      draft.tones,
    )
  }

  const appendToStage = (prog: ChordBar[]) => {
    setChords({
      ...chords,
      stage: [...chords.stage, ...cloneProg(prog)],
    })
  }

  const addRoot = (rootId: ChordRootId) => {
    const quality = qualityForFreeAdd(rootId, scale, chords.qualityEnable)
    setChords({
      ...chords,
      stage: appendChordRoot(
        chords.stage,
        rootId,
        quality,
        keyRoot,
        scale,
        bpm,
      ),
    })
  }

  const applyPreset = (id: string) => {
    const prog = progressionFromPreset(
      id,
      keyRoot,
      scale,
      bpm,
      chords.qualityEnable,
      chords.rootEnable,
    )
    if (prog) appendToStage(prog)
  }

  const enabledRootDefs = CHORD_ROOT_DEFS.filter(
    (d) => chords.rootEnable?.[d.id],
  )

  return (
    <div className="app layer-page layer-page--chords">
      {arrangeSource && (
        <ArrangeModal
          title="コードのちょいアレンジ"
          sourcePreview={
            <ChordProgPreview prog={arrangeSource} labelMode={labelMode} />
          }
          variants={arrangeVariants}
          onClose={() => setArrangeSource(null)}
          onRefresh={() =>
            setArrangeVariants(generateChordArrangeVariants(arrangeSource, 5))
          }
          onPreview={(v) => void listen(v.progression)}
          onAdd={(v) => {
            appendToStage(v.progression)
            setArrangeSource(null)
          }}
          renderVariant={(v) => (
            <ChordProgPreview prog={v.progression} labelMode={labelMode} />
          )}
        />
      )}
      <header className="app__header">
        <h1>雰囲気コード</h1>
        <p className="app__lead">
          1小節に1コード。ルート（I〜VII＋半音）とコード種類を選んで生成できます。
          鳴らし方で同時押し・アルペジオなどを選べます。候補をタップするとちょいアレンジ案が出ます。
        </p>
        <KeySyncCheckbox layer="chords" />
      </header>

      <section className="app__section">
        <div className="layer-controls">
          <label>
            コード用キー
            <select
              value={keyRoot}
              onChange={(e) => setChordKey(Number(e.target.value), scale)}
            >
              {KEY_NAMES.map((_, i) => (
                <option key={i} value={i}>
                  {keyOptionLabel(i)}
                </option>
              ))}
            </select>
          </label>
          <label>
            スケール
            <select
              value={scale}
              onChange={(e) =>
                setChordKey(
                  keyRoot,
                  e.target.value as 'major' | 'minor',
                )
              }
            >
              <option value="major">メジャー</option>
              <option value="minor">マイナー</option>
            </select>
          </label>
          <p className="chord-project-key">
            プロジェクトキー: <strong>{projectKeyLabel}</strong>
            {draft.keySync.chords ? '（連動中）' : '（コードは別キー）'}
          </p>
          <label>
            モード
            <select
              value={chords.mode}
              onChange={(e) =>
                setChords({
                  ...chords,
                  mode: e.target.value as typeof chords.mode,
                })
              }
            >
              <option value="random">ランダム</option>
              <option value="markov">遷移確率（直前依存）</option>
              <option value="free">自由＋定番進行</option>
            </select>
          </label>
          <label>
            構成音の表記
            <select
              value={labelMode}
              onChange={(e) =>
                setChords({
                  ...chords,
                  noteLabelMode: e.target.value as 'letter' | 'solfege',
                })
              }
            >
              <option value="letter">英名（C · E · G）</option>
              <option value="solfege">ドレミ（ド · ミ · ソ）</option>
            </select>
          </label>
          <label>
            鳴らし方
            <select
              title="おまかせ（区間ごと）: はじめるタブで作った区間はそれぞれの弾き方、それ以外の小節は同時押しで鳴らします"
              value={chords.playStyle ?? 'block'}
              onChange={(e) =>
                setChords({
                  ...chords,
                  playStyle: e.target.value as ChordPlayStyleId,
                })
              }
            >
              {CHORD_PLAY_STYLE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          {chords.mode !== 'free' && (
            <>
              <label>
                小節数
                <select
                  value={chords.barCount}
                  onChange={(e) =>
                    setChords({
                      ...chords,
                      barCount: Number(e.target.value),
                    })
                  }
                >
                  {[2, 4, 8].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                候補数
                <select
                  value={Math.min(8, Math.max(4, chords.candidateCount || 6))}
                  onChange={(e) =>
                    setChords({
                      ...chords,
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
            </>
          )}
        </div>

        <RootChecks
          map={chords.rootEnable}
          onChange={(rootEnable) => setChords({ ...chords, rootEnable })}
        />
        <QualityChecks
          title="コードの種類（maj / 7 / sus など）"
          hint="オンの種類だけが、上で選んだルートに乗って出ます。トニックを maj7 だけにしたい場合もここで maj7 をオンにしてください。"
          map={chords.qualityEnable}
          onChange={(qualityEnable) => setChords({ ...chords, qualityEnable })}
        />

        {chords.mode === 'free' && (
          <div className="chord-free">
            <p className="layer-hint">ルートを押して譜面に追加（追記）</p>
            <div className="chord-palette">
              {enabledRootDefs.map((def) => {
                const quality = qualityForFreeAdd(
                  def.id,
                  scale,
                  chords.qualityEnable,
                )
                const sample = makeChordBarFromRoot(
                  def.id,
                  quality,
                  keyRoot,
                  scale,
                  bpm,
                )
                return (
                  <button
                    key={def.id}
                    type="button"
                    className="btn"
                    onClick={() => addRoot(def.id)}
                  >
                    {chordSymbolName(sample)}
                  </button>
                )
              })}
            </div>
            <p className="layer-hint">定番進行（譜面へ追記）</p>
            <div className="chord-palette">
              {presetsForScale(scale).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="btn primary"
                  onClick={() => applyPreset(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {chords.mode !== 'free' && (
        <section className="app__section">
          <div className="app__section-head app__section-head--plain">
            <h2>候補</h2>
          </div>
          {chords.candidates.length === 0 ? (
            <div className="candidate-pool-wrap">
              <div className="candidate-pool candidate-pool--empty">
                <p className="candidate-pool__empty-title">まだ候補がありません</p>
                <p>ルートと種類を選んで「生成」を押すと進行候補が並びます。</p>
              </div>
            </div>
          ) : (
            <div className="candidate-pool-wrap">
              <div className="candidate-pool">
                {chords.candidates.map((prog, i) => (
                  <article
                    key={i}
                    className="candidate-card candidate-card--arrangeable"
                    onClick={() => openArrange(prog)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        openArrange(prog)
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    title="タップでちょいアレンジ"
                  >
                    <header className="candidate-card__head">
                      <span className="candidate-card__label">
                        候補 {i + 1} · {prog.length}小節
                      </span>
                      <div
                        className="candidate-card__actions"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <PlayStopButton
                          label="聴く"
                          onPlay={() => void listen(prog)}
                        />
                        <button type="button" onClick={() => openArrange(prog)}>
                          アレンジ
                        </button>
                        <button
                          type="button"
                          className="primary"
                          onClick={() => appendToStage(prog)}
                        >
                          譜面へ
                        </button>
                      </div>
                    </header>
                    <ChordProgPreview prog={prog} labelMode={labelMode} />
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <section className="app__section app__section--score">
        <div className="app__section-head">
          <h2>コード譜面</h2>
          <div className="app__score-actions-row">
            <PlayStopButton
              label="譜面を再生"
              className="btn btn--score"
              disabled={chords.stage.length === 0}
              onPlay={() => void listen(chords.stage)}
            />
            <button
              type="button"
              className="btn btn--danger"
              disabled={chords.stage.length === 0}
              onClick={() => setChords({ ...chords, stage: [] })}
            >
              一括削除
            </button>
          </div>
        </div>
        {chords.stage.length === 0 ? (
          <div className="stage-wrap">
            <div className="stage stage--empty">
              <p className="stage__empty-title">まだ譜面が空です</p>
              <p>候補の「譜面へ」やルートボタン・定番進行で、続けて追加できます。</p>
            </div>
          </div>
        ) : (
          <div className="stage-wrap">
            <ul className="stage__list">
              {chords.stage.map((c, i) => (
                <li key={c.id} className="stage__item">
                  <div className="stage__item-meta">
                    <span className="stage__item-title">
                      小節 {i + 1}
                      {sectionLabelAt(draft.sections, i) && (
                        <span className="stage__section-tag">
                          {sectionLabelAt(draft.sections, i)}
                        </span>
                      )}
                    </span>
                    <div className="stage__item-actions">
                      <PlayStopButton
                        label="聴く"
                        onPlay={() => void listen([c])}
                      />
                      <button
                        type="button"
                        className="danger"
                        onClick={() =>
                          setChords({
                            ...chords,
                            stage: chords.stage.filter((x) => x.id !== c.id),
                          })
                        }
                      >
                        削除
                      </button>
                    </div>
                  </div>
                  <p className="layer-card-seq layer-card-seq--center">
                    {chordSymbolName(c)}
                  </p>
                  <p className="layer-card-tones layer-card-tones--center">
                    {chordTonesLine(c, labelMode)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}

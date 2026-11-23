import { useEffect, useMemo, useState, type DragEvent } from 'react'
import { playLayers } from '../audio/player'
import { AppFooter } from '../components/AppFooter'
import { PlayStopButton } from '../components/PlayStopButton'
import { SongEditor, SongOverview } from '../components/SongView'
import { TonePicker } from '../components/TonePicker'
import {
  BGM_ENDINGS,
  BGM_MAX_BLOCKS,
  BGM_MAX_BLOCK_BARS,
  BGM_MAX_BPM,
  BGM_MAX_SECONDS,
  BGM_MIN_BLOCK_BARS,
  BGM_MIN_BPM,
  BGM_MIN_SECONDS,
  arrangementBars,
  barSeconds,
  clampInt,
  formatSeconds,
  secondsOfBars,
  targetBarOptions,
  type BgmEnding,
} from '../core/bgm/plan'
import { generateBgm } from '../core/bgm/generate'
import {
  makeBlock,
  readBgmSession,
  writeBgmSession,
  type BgmSession,
} from '../core/bgm/session'
import { moodById, MOODS, type MoodId } from '../core/mood/presets'
import { useProject } from '../core/ProjectContext'
import { createDefaultMixer } from '../core/projectTypes'
import { KEY_NAMES, keyOptionLabel } from '../core/scale'
import './ComposerPage.css'
import './LayerPages.css'
import './SectionsPage.css'
import './StartPage.css'
import './BgmPage.css'

const BLOCK_COUNTS = Array.from({ length: BGM_MAX_BLOCKS }, (_, i) => i + 1)

type DragPayload = { kind: 'add'; blockId: string } | { kind: 'move'; index: number }

function readPayload(e: DragEvent): DragPayload | null {
  const raw = e.dataTransfer.getData('text/plain')
  if (raw.startsWith('add:')) return { kind: 'add', blockId: raw.slice(4) }
  if (raw.startsWith('move:')) {
    const index = Number(raw.slice(5))
    return Number.isInteger(index) ? { kind: 'move', index } : null
  }
  return null
}

export default function BgmPage() {
  const { draft, setTones } = useProject()
  const [s, setS] = useState<BgmSession>(() => readBgmSession())
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const [viewOpen, setViewOpen] = useState(false)

  useEffect(() => {
    writeBgmSession(s)
  }, [s])

  /** Change settings. A tune made before the change is kept but marked as out of date. */
  const update = (patch: Partial<BgmSession>) =>
    setS((prev) => ({ ...prev, ...patch, stale: prev.song != null }))

  const mood = moodById(s.moodId)
  const { exact, options } = useMemo(
    () => targetBarOptions(s.seconds, s.bpm),
    [s.seconds, s.bpm],
  )
  const target =
    s.pickedTarget != null && options.includes(s.pickedTarget) ? s.pickedTarget : options[0]!
  const total = arrangementBars(s.arrangement, s.blocks)
  const diff = total - target
  const ready = s.arrangement.length > 0 && diff === 0
  const blockById = new Map(s.blocks.map((b) => [b.id, b]))
  const blockIndex = (id: string) => s.blocks.findIndex((b) => b.id === id)

  const setBlockCount = (count: number) => {
    const blocks = Array.from({ length: count }, (_, i) => s.blocks[i] ?? makeBlock(i))
    const keep = new Set(blocks.map((b) => b.id))
    update({ blocks, arrangement: s.arrangement.filter((id) => keep.has(id)) })
  }

  const setBlockBars = (id: string, value: number) => {
    const bars = clampInt(value, BGM_MIN_BLOCK_BARS, BGM_MAX_BLOCK_BARS)
    update({ blocks: s.blocks.map((b) => (b.id === id ? { ...b, bars } : b)) })
  }

  const insertAt = (index: number, id: string) => {
    const next = [...s.arrangement]
    next.splice(index, 0, id)
    update({ arrangement: next })
  }

  const moveItem = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || to >= s.arrangement.length) return
    const next = [...s.arrangement]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item!)
    update({ arrangement: next })
  }

  const dropAt = (e: DragEvent, index: number) => {
    e.preventDefault()
    setOverIndex(null)
    const payload = readPayload(e)
    if (!payload) return
    if (payload.kind === 'add') {
      insertAt(index, payload.blockId)
      return
    }
    const from = payload.index
    if (from < 0 || from >= s.arrangement.length) return
    const next = [...s.arrangement]
    const [item] = next.splice(from, 1)
    next.splice(index > from ? index - 1 : index, 0, item!)
    update({ arrangement: next })
  }

  const make = () => {
    if (!ready || busy) return
    setBusy(true)
    window.setTimeout(() => {
      try {
        const song = generateBgm({
          blocks: s.blocks,
          arrangement: s.arrangement,
          keyRoot: s.keyRoot,
          scale: s.scale,
          bpm: s.bpm,
          mood,
          ending: s.ending,
        })
        setViewOpen(false)
        setS((prev) => ({ ...prev, song, stale: false }))
      } finally {
        setBusy(false)
      }
    }, 30)
  }

  const song = s.song
  const layers = song
    ? { melody: song.melody, chords: song.chords, bass: song.bass, drums: song.drums }
    : null

  const play = async () => {
    if (!layers) return
    await playLayers(layers, createDefaultMixer(), undefined, {
      chordPlayStyle: 'auto',
      tones: draft.tones,
    })
  }

  const saveWav = () => {
    if (!layers) return
    setExporting(true)
    void import('../export/wav')
      .then(({ downloadMixWav }) =>
        downloadMixWav(layers, createDefaultMixer(), 'short-bgm.wav', 'auto', draft.tones),
      )
      .catch((err: unknown) => {
        console.error(err)
        const msg = err instanceof Error ? err.message : String(err)
        window.alert(`WAV の書き出しに失敗しました。\n${msg}`)
      })
      .finally(() => setExporting(false))
  }

  const saveMidi = () => {
    if (!layers) return
    void import('../export/midi')
      .then(({ downloadMultiTrackMidi }) =>
        downloadMultiTrackMidi(layers, 'short-bgm.mid', draft.tones, 'auto'),
      )
      .catch((err: unknown) => {
        console.error(err)
        window.alert('MIDI の書き出しに失敗しました。')
      })
  }

  const statusText = (() => {
    if (s.arrangement.length === 0) return 'パターンを下の並び順に入れてください。'
    if (diff === 0) return `ぴったりです。${total}小節（約${formatSeconds(secondsOfBars(total, s.bpm))}）`
    if (diff < 0) return `あと${-diff}小節 足りません（いま${total}小節）`
    return `${diff}小節 多いです（いま${total}小節）`
  })()

  const [lowMood, highMood] = mood.bpm

  return (
    <div className="app layer-page layer-page--bgm">
      <header className="app__header">
        <h1>ショートBGM</h1>
        <p className="app__lead">
          ショート動画に合わせた長さのBGMを作ります。
          <br />
          長さ・速さ・キー・雰囲気を選び、パターンを並べて、小節数がぴったりなら作れます。
        </p>
      </header>

      <section className="app__section">
        <h2>雰囲気</h2>
        <div className="mood-grid" role="listbox" aria-label="雰囲気">
          {MOODS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={item.id === s.moodId}
              className={`mood-card${item.id === s.moodId ? ' is-selected' : ''}`}
              onClick={() => update({ moodId: item.id as MoodId })}
            >
              <span className="mood-card__label">{item.label}</span>
              <span className="mood-card__blurb">{item.blurb}</span>
            </button>
          ))}
        </div>
        <p className="layer-hint">
          「{mood.label}」に合う速さの目安は BPM {lowMood}〜{highMood} です。速さとキーは下で自由に決められます。
        </p>
      </section>

      <section className="app__section">
        <h2>長さ・速さ・キー</h2>
        <div className="bgm-fields">
          <label className="section-bars">
            長さ（秒）
            <input
              type="number"
              min={BGM_MIN_SECONDS}
              max={BGM_MAX_SECONDS}
              value={s.seconds}
              onChange={(e) =>
                update({
                  seconds: clampInt(Number(e.target.value), BGM_MIN_SECONDS, BGM_MAX_SECONDS),
                  pickedTarget: null,
                })
              }
            />
          </label>
          <label className="section-bars">
            BPM
            <input
              type="number"
              min={BGM_MIN_BPM}
              max={BGM_MAX_BPM}
              value={s.bpm}
              onChange={(e) =>
                update({
                  bpm: clampInt(Number(e.target.value), BGM_MIN_BPM, BGM_MAX_BPM),
                  pickedTarget: null,
                })
              }
            />
          </label>
          <label className="section-bars">
            キー
            <select
              value={s.keyRoot}
              onChange={(e) => update({ keyRoot: Number(e.target.value) })}
            >
              {KEY_NAMES.map((_, i) => (
                <option key={i} value={i}>
                  {keyOptionLabel(i)}
                </option>
              ))}
            </select>
          </label>
          <label className="section-bars">
            長調・短調
            <select
              value={s.scale}
              onChange={(e) => update({ scale: e.target.value as 'major' | 'minor' })}
            >
              <option value="major">長調（メジャー）</option>
              <option value="minor">短調（マイナー）</option>
            </select>
          </label>
        </div>
        <input
          className="bgm-range"
          type="range"
          aria-label="長さ（秒）"
          min={BGM_MIN_SECONDS}
          max={BGM_MAX_SECONDS}
          step={1}
          value={s.seconds}
          onChange={(e) => update({ seconds: Number(e.target.value), pickedTarget: null })}
        />
        <p className="layer-hint">
          1小節は{barSeconds(s.bpm).toFixed(2).replace(/0$/, '')}秒です。
          {formatSeconds(s.seconds)}なら {exact.toFixed(2).replace(/\.?0+$/, '')} 小節ぶんです。
        </p>
        {/* Always the same height, so the cards below do not jump when the choice appears. */}
        <fieldset className="bgm-target">
          <legend>目標の小節数</legend>
          {(options.length > 1 ? options : [options[0]!, options[0]! + 1]).map((n, i) => {
            const real = options.length > 1 || i === 0
            return (
              <label
                key={n}
                className={`bgm-target__option${real ? '' : ' is-ghost'}`}
                aria-hidden={real ? undefined : true}
              >
                <input
                  type="radio"
                  name="bgm-target"
                  checked={target === n}
                  disabled={options.length === 1}
                  tabIndex={real ? undefined : -1}
                  onChange={() => update({ pickedTarget: n })}
                />
                {n}小節（約{formatSeconds(secondsOfBars(n, s.bpm))}）
                <span className="bgm-target__tag">
                  {options.length > 1 && i === 0 ? '少ない方' : '多い方'}
                </span>
              </label>
            )
          })}
          {/* Both notes share one cell, so the box keeps its height either way. */}
          <div className="bgm-target__notes">
            <p className={`bgm-target__note${options.length > 1 ? '' : ' is-ghost'}`}>
              割り切れないので、どちらかを選んでください。
            </p>
            <p className={`bgm-target__note${options.length > 1 ? ' is-ghost' : ''}`}>
              ちょうど割り切れるので、この小節数で決まりです。
            </p>
          </div>
        </fieldset>
      </section>

      <section className="app__section">
        <h2>パターン</h2>
        <div className="bgm-fields">
          <label className="section-bars">
            パターン数
            <select
              value={s.blocks.length}
              onChange={(e) => setBlockCount(Number(e.target.value))}
            >
              {BLOCK_COUNTS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <ul className="bgm-blocks">
          {s.blocks.map((block, i) => (
            <li key={block.id} className={`bgm-blocks__item bgm-color-${i}`}>
              <span className="bgm-blocks__label">{block.label}</span>
              <label className="section-bars">
                小節数
                <input
                  type="number"
                  min={BGM_MIN_BLOCK_BARS}
                  max={BGM_MAX_BLOCK_BARS}
                  value={block.bars}
                  onChange={(e) => setBlockBars(block.id, Number(e.target.value))}
                />
              </label>
            </li>
          ))}
        </ul>
        <p className="layer-hint">
          1〜{BGM_MAX_BLOCK_BARS}小節で入力します。Aは主題、あとのパターンほど盛り上がる作りになります。
        </p>
      </section>

      <section className="app__section">
        <h2>並び順</h2>
        <p className="layer-hint">
          パターンをここへドラッグするか、ボタンで足します。並べ替えもドラッグでできます。同じパターンは何度でも使えます。
        </p>
        <div className="bgm-palette">
          {s.blocks.map((block, i) => (
            <button
              key={block.id}
              type="button"
              draggable
              className={`bgm-chip bgm-color-${i}`}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', `add:${block.id}`)
                e.dataTransfer.effectAllowed = 'copy'
              }}
              onClick={() => insertAt(s.arrangement.length, block.id)}
              title={`${block.label}を最後に足す`}
            >
              <span className="bgm-chip__label">＋{block.label}</span>
              <span className="bgm-chip__bars">{block.bars}小節</span>
            </button>
          ))}
        </div>
        <ol
          className={`bgm-arrangement${overIndex === s.arrangement.length ? ' is-over-end' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setOverIndex(s.arrangement.length)
          }}
          onDragLeave={() => setOverIndex(null)}
          onDrop={(e) => dropAt(e, s.arrangement.length)}
        >
          {s.arrangement.length === 0 && (
            <li className="bgm-arrangement__empty">ここにパターンを置きます</li>
          )}
          {s.arrangement.map((id, index) => {
            const block = blockById.get(id)
            if (!block) return null
            return (
              <li
                key={`${id}-${index}`}
                draggable
                className={`bgm-slot bgm-color-${blockIndex(id)}${overIndex === index ? ' is-over' : ''}`}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', `move:${index}`)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setOverIndex(index)
                }}
                onDrop={(e) => {
                  e.stopPropagation()
                  dropAt(e, index)
                }}
                onDragEnd={() => setOverIndex(null)}
              >
                <span className="bgm-slot__label">{block.label}</span>
                <span className="bgm-slot__bars">{block.bars}小節</span>
                <span className="bgm-slot__tools">
                  <button
                    type="button"
                    aria-label="前へ"
                    disabled={index === 0}
                    onClick={() => moveItem(index, index - 1)}
                  >
                    ◀
                  </button>
                  <button
                    type="button"
                    aria-label="後ろへ"
                    disabled={index === s.arrangement.length - 1}
                    onClick={() => moveItem(index, index + 1)}
                  >
                    ▶
                  </button>
                  <button
                    type="button"
                    aria-label="外す"
                    onClick={() =>
                      update({ arrangement: s.arrangement.filter((_, i) => i !== index) })
                    }
                  >
                    ✕
                  </button>
                </span>
              </li>
            )
          })}
        </ol>
        <p className={`bgm-status${ready ? ' is-ok' : ' is-ng'}`} role="status">
          {ready ? '✓ ' : '× '}
          {statusText}
          <span className="bgm-status__target">
            　目標 {target}小節（約{formatSeconds(secondsOfBars(target, s.bpm))}）
          </span>
        </p>
      </section>

      <section className="app__section">
        <h2>終わり方</h2>
        <div className="bgm-endings" role="radiogroup" aria-label="終わり方">
          {BGM_ENDINGS.map((item) => (
            <label key={item.id} className={`bgm-ending${s.ending === item.id ? ' is-selected' : ''}`}>
              <input
                type="radio"
                name="bgm-ending"
                checked={s.ending === item.id}
                onChange={() => update({ ending: item.id as BgmEnding })}
              />
              <span className="bgm-ending__label">{item.label}</span>
              <span className="bgm-ending__blurb">{item.blurb}</span>
            </label>
          ))}
        </div>
        {s.ending === 'hold' && (
          <p className="layer-hint">「伸ばす」は、目標の小節数のあとに1小節ぶん余韻がつきます。</p>
        )}
      </section>

      <section className="app__section">
        <h2>音色</h2>
        <TonePicker tones={draft.tones} onChange={setTones} />
      </section>

      <section className="app__section">
        <div className="app__section-head">
          <h2>作る</h2>
          <div className="app__score-actions-row">
            <button
              type="button"
              className="btn primary"
              disabled={!ready || busy}
              onClick={make}
            >
              {busy ? '作っています…' : song ? 'もう一度作る' : 'BGMを作る'}
            </button>
          </div>
        </div>
        {!ready && <p className="layer-hint">並び順の小節数が目標とぴったり合うと、作れます。</p>}
        {song && (
          <div className="bgm-result">
            <p className="bgm-result__meta">
              {song.bars}小節 · 約{formatSeconds(secondsOfBars(song.bars, s.bpm))}
              {song.bars > song.planBars ? '（余韻1小節を含む）' : ''}
            </p>
            {s.stale && (
              <p className="layer-hint">
                設定を変えました。いまの曲は変える前のものです。作り直すと反映されます。
              </p>
            )}
            <SongOverview song={song} onOpen={() => setViewOpen(true)} />
            <div className="export-actions">
              <PlayStopButton
                label="聴く"
                className="btn btn--score"
                onPlay={() => void play()}
              />
              <button type="button" className="btn" disabled={exporting} onClick={saveWav}>
                {exporting ? 'WAVを作っています…' : 'WAVで保存'}
              </button>
              <button type="button" className="btn" onClick={saveMidi}>
                MIDIで保存
              </button>
            </div>
          </div>
        )}
      </section>

      {song && viewOpen && (
        <SongEditor
          song={song}
          bpm={s.bpm}
          keyRoot={s.keyRoot}
          scale={s.scale}
          tones={draft.tones}
          onChange={(next) => setS((prev) => ({ ...prev, song: next }))}
          onClose={() => setViewOpen(false)}
          onPlay={() => void play()}
        />
      )}

      <AppFooter />
    </div>
  )
}

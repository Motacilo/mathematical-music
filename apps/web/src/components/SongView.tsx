import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { playPhrases } from '../audio/player'
import {
  canMerge,
  canSplit,
  DURATION_LABELS,
  fitBarToChord,
  mergeWithNext,
  neighbour,
  pitchBefore,
  selectedNote,
  setChord,
  shiftPitch,
  splitNote,
  toggleRest,
  type NoteLayer,
  type Selection,
} from '../core/bgm/edit'
import type { BgmSong } from '../core/bgm/generate'
import { chordSymbolName } from '../core/chords/theory'
import { CHORD_PLAY_STYLE_OPTIONS, CONCRETE_STYLES } from '../core/chords/playStyle'
import { CHORD_ROOT_DEFS } from '../core/chords/roots'
import {
  CHORD_QUALITY_LABELS,
  type ChordQuality,
  type ConcreteChordPlayStyle,
} from '../core/projectTypes'
import { DURATION_BEATS } from '../core/rhythm'
import { midiToNoteName } from '../core/scale'
import type { ToneMap } from '../core/tones/presets'
import type { Phrase, ScaleType } from '../core/types'
import { PlayStopButton } from './PlayStopButton'
import './SongView.css'

type LaneNote = {
  bar: number
  index: number
  beat: number
  dur: number
  pitch: number
  rest: boolean
}

function laneNotes(phrases: Phrase[]): LaneNote[] {
  const out: LaneNote[] = []
  phrases.forEach((phrase, bar) => {
    let beat = bar * 4
    phrase.notes.forEach((note, index) => {
      const dur = DURATION_BEATS[note.duration]
      out.push({ bar, index, beat, dur, pitch: note.pitch, rest: !!note.rest })
      beat += dur
    })
  })
  return out
}

function pitchBounds(notes: LaneNote[]): { min: number; max: number } {
  const sounding = notes.filter((n) => !n.rest).map((n) => n.pitch)
  let min = sounding.length ? Math.min(...sounding) - 2 : 55
  let max = sounding.length ? Math.max(...sounding) + 2 : 72
  if (max - min < 12) {
    const mid = (max + min) / 2
    min = Math.floor(mid - 6)
    max = Math.ceil(mid + 6)
  }
  return { min, max }
}

const colorClass = (index: number) => (index < 0 ? 'sv-color-end' : `bgm-color-${index % 6}`)

/** The melody of the whole song squeezed into one strip. Click to open the full view. */
export function SongOverview({
  song,
  onOpen,
}: {
  song: BgmSong
  onOpen: () => void
}) {
  const notes = useMemo(() => laneNotes(song.melody), [song.melody])
  const { min, max } = pitchBounds(notes)
  const rows = max - min + 1
  const totalBeats = song.bars * 4
  return (
    <button
      type="button"
      className="sv-overview"
      onClick={onOpen}
      aria-label="できたメロディ。クリックで拡大して全パートを見る"
    >
      <svg
        className="sv-overview__svg"
        viewBox={`0 0 ${totalBeats} ${rows}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        {song.sections.map((section, i) => (
          <rect
            key={i}
            x={section.startBar * 4}
            y={0}
            width={section.bars * 4}
            height={rows}
            className={`sv-band ${colorClass(section.colorIndex)}`}
          />
        ))}
        {notes
          .filter((n) => !n.rest)
          .map((n) => (
            <rect
              key={`${n.bar}-${n.index}`}
              x={n.beat}
              y={max - n.pitch}
              width={Math.max(n.dur * 0.9, 0.2)}
              height={0.9}
              className="sv-overview__note"
            />
          ))}
      </svg>
      <span className="sv-overview__hint">クリックで拡大（全パートの表示・音の編集）</span>
    </button>
  )
}

const NOTE_LAYER_LABEL: Record<NoteLayer, string> = { melody: 'メロディ', bass: 'ベース' }
const ROW_PX = 7

function NoteLane({
  song,
  layer,
  ppb,
  selection,
  onSelect,
}: {
  song: BgmSong
  layer: NoteLayer
  ppb: number
  selection: Selection
  onSelect: (sel: Selection) => void
}) {
  const notes = useMemo(() => laneNotes(song[layer]), [song, layer])
  const { min, max } = pitchBounds(notes)
  const rows = max - min + 1
  const width = song.bars * 4 * ppb
  const octaveLines: number[] = []
  for (let p = min; p <= max; p++) if (p % 12 === 0) octaveLines.push(p)
  return (
    <svg
      className="sv-lane__svg"
      width={width}
      height={rows * ROW_PX}
      role="group"
      aria-label={NOTE_LAYER_LABEL[layer]}
    >
      {octaveLines.map((p) => (
        <line
          key={p}
          x1={0}
          x2={width}
          y1={(max - p + 1) * ROW_PX}
          y2={(max - p + 1) * ROW_PX}
          className="sv-octave"
        />
      ))}
      {notes.map((n) => {
        const picked =
          selection != null &&
          selection.layer === layer &&
          'index' in selection &&
          selection.bar === n.bar &&
          selection.index === n.index
        const x = n.beat * ppb
        const w = Math.max(n.dur * ppb - 1, 3)
        if (n.rest) {
          return (
            <rect
              key={`${n.bar}-${n.index}`}
              x={x}
              y={0}
              width={w}
              height={rows * ROW_PX}
              className={`sv-rest${picked ? ' is-selected' : ''}`}
              onClick={() => onSelect({ layer, bar: n.bar, index: n.index })}
            >
              <title>休符</title>
            </rect>
          )
        }
        return (
          <rect
            key={`${n.bar}-${n.index}`}
            x={x}
            y={(max - n.pitch) * ROW_PX}
            width={w}
            height={ROW_PX - 1}
            rx={1.5}
            className={`sv-note sv-note--${layer}${picked ? ' is-selected' : ''}`}
            onClick={() => onSelect({ layer, bar: n.bar, index: n.index })}
          >
            <title>{midiToNoteName(n.pitch)}</title>
          </rect>
        )
      })}
    </svg>
  )
}

const DRUM_ROWS = ['hat', 'snare', 'kick'] as const

function DrumLane({ song, ppb }: { song: BgmSong; ppb: number }) {
  const width = song.bars * 4 * ppb
  const hits: { instrument: (typeof DRUM_ROWS)[number]; beat: number }[] = []
  let origin = 0
  for (const phrase of song.drums) {
    for (const hit of phrase.hits) hits.push({ instrument: hit.instrument, beat: origin + hit.beat })
    origin += phrase.bars * 4
  }
  const rowH = 8
  return (
    <svg className="sv-lane__svg" width={width} height={DRUM_ROWS.length * rowH + 2} aria-label="リズム">
      {hits.map((h, i) => (
        <rect
          key={i}
          x={h.beat * ppb}
          y={DRUM_ROWS.indexOf(h.instrument) * rowH + 1}
          width={Math.max(ppb * 0.25, 2)}
          height={rowH - 2}
          className={`sv-drum sv-drum--${h.instrument}`}
        />
      ))}
    </svg>
  )
}

type EditorProps = {
  song: BgmSong
  bpm: number
  keyRoot: number
  scale: ScaleType
  tones: ToneMap
  onChange: (song: BgmSong) => void
  onClose: () => void
  onPlay: () => void | Promise<void>
}

const EDIT_STYLES = CHORD_PLAY_STYLE_OPTIONS.filter((o) =>
  (CONCRETE_STYLES as readonly string[]).includes(o.id),
)

export function SongEditor({
  song,
  bpm,
  keyRoot,
  scale,
  tones,
  onChange,
  onClose,
  onPlay,
}: EditorProps) {
  const [selection, setSelection] = useState<Selection>(null)
  const [ppb, setPpb] = useState(16)
  const barPx = ppb * 4
  const width = song.bars * barPx

  const audition = (layer: NoteLayer, bar: number, pitch: number) => {
    const phrase = song[layer][bar]
    if (!phrase) return
    void playPhrases(
      [{ ...phrase, id: 'audition', bars: 1, bpm, notes: [{ pitch, duration: '4n' }] }],
      undefined,
      layer,
      tones,
    )
  }

  const apply = (next: BgmSong, sel: Selection = selection) => {
    onChange(next)
    setSelection(sel)
  }

  const nudge = (semitones: number) => {
    if (!selection || selection.layer === 'chords') return
    const next = shiftPitch(song, selection, semitones)
    if (next === song) return
    apply(next)
    const note = selectedNote(next, selection)
    if (note && !note.rest) audition(selection.layer, selection.bar, note.pitch)
  }

  const flipRest = () => {
    if (!selection || selection.layer === 'chords') return
    const fallback = selection.layer === 'bass' ? 48 : 60 + keyRoot
    const next = toggleRest(song, selection, fallback)
    apply(next)
    const note = selectedNote(next, selection)
    if (note && !note.rest) audition(selection.layer, selection.bar, note.pitch)
  }

  const move = (dir: 1 | -1) => {
    const next = neighbour(song, selection, dir)
    setSelection(next)
    const note = selectedNote(song, next)
    if (next && next.layer !== 'chords' && note && !note.rest) {
      audition(next.layer, next.bar, note.pitch)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (!selection) return
      const step = e.shiftKey ? 12 : 1
      if (e.key === 'ArrowUp') nudge(step)
      else if (e.key === 'ArrowDown') nudge(-step)
      else if (e.key === 'ArrowLeft') move(-1)
      else if (e.key === 'ArrowRight') move(1)
      else if (e.key === 'Delete' || e.key === 'Backspace') flipRest()
      else return
      e.preventDefault()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const ruler: ReactNode[] = []
  const labelEvery = barPx >= 56 ? 1 : barPx >= 28 ? 2 : barPx >= 14 ? 4 : 8
  for (let bar = 0; bar < song.bars; bar += labelEvery) {
    ruler.push(
      <span key={bar} className="sv-ruler__num" style={{ left: bar * barPx }}>
        {bar + 1}
      </span>,
    )
  }

  const note = selectedNote(song, selection)
  const chordSel = selection?.layer === 'chords' ? selection : null
  const chord = chordSel ? song.chords[chordSel.bar] : null

  const trackStyle = { width, ['--bar-px' as string]: `${barPx}px` }

  return (
    <div className="sv-modal" role="dialog" aria-modal="true" aria-label="できた曲">
      <div className="sv-modal__panel">
        <header className="sv-modal__head">
          <h3 className="sv-modal__title">できた曲（{song.bars}小節）</h3>
          <div className="sv-modal__actions">
            <PlayStopButton label="通しで聴く" className="btn btn--score" onPlay={onPlay} />
            <label className="sv-zoom">
              拡大
              <input
                type="range"
                min={6}
                max={40}
                value={ppb}
                onChange={(e) => setPpb(Number(e.target.value))}
              />
            </label>
            <button type="button" className="btn" onClick={onClose}>
              閉じる
            </button>
          </div>
        </header>

        <div className="sv-scroll">
          <div className="sv-row">
            <div className="sv-label" />
            <div className="sv-track sv-ruler" style={trackStyle}>
              {song.sections.map((section, i) => (
                <span
                  key={i}
                  className={`sv-section ${colorClass(section.colorIndex)}`}
                  style={{ left: section.startBar * barPx, width: section.bars * barPx - 2 }}
                >
                  {section.label}
                </span>
              ))}
              {ruler}
            </div>
          </div>

          <div className="sv-row">
            <div className="sv-label">メロディ</div>
            <div className="sv-track sv-grid" style={trackStyle}>
              <NoteLane song={song} layer="melody" ppb={ppb} selection={selection} onSelect={setSelection} />
            </div>
          </div>

          <div className="sv-row">
            <div className="sv-label">コード</div>
            <div className="sv-track sv-grid sv-chords" style={trackStyle}>
              {song.chords.map((bar, i) => (
                <button
                  key={bar.id}
                  type="button"
                  className={`sv-chord${chordSel?.bar === i ? ' is-selected' : ''}`}
                  style={{ left: i * barPx, width: barPx - 2 }}
                  onClick={() => setSelection({ layer: 'chords', bar: i })}
                  title={chordSymbolName(bar)}
                >
                  {chordSymbolName(bar)}
                </button>
              ))}
            </div>
          </div>

          <div className="sv-row">
            <div className="sv-label">ベース</div>
            <div className="sv-track sv-grid" style={trackStyle}>
              <NoteLane song={song} layer="bass" ppb={ppb} selection={selection} onSelect={setSelection} />
            </div>
          </div>

          <div className="sv-row">
            <div className="sv-label">リズム</div>
            <div className="sv-track sv-grid" style={trackStyle}>
              <DrumLane song={song} ppb={ppb} />
            </div>
          </div>
        </div>

        <footer className="sv-edit">
          {!selection && (
            <p className="sv-edit__hint">
              メロディかベースの音、またはコードを選ぶと、ここで直せます。矢印キー（↑↓で高さ、←→で隣の音）も使えます。リズムは見るだけです。
            </p>
          )}

          {selection && selection.layer !== 'chords' && note && (
            <>
              <p className="sv-edit__title">
                {NOTE_LAYER_LABEL[selection.layer]} · {selection.bar + 1}小節目 · {' '}
                {note.rest ? '休符' : midiToNoteName(note.pitch)} · {DURATION_LABELS[note.duration]}
              </p>
              <div className="sv-edit__buttons">
                <button type="button" className="btn" onClick={() => move(-1)}>◀ 前の音</button>
                <button type="button" className="btn" onClick={() => move(1)}>次の音 ▶</button>
                <button type="button" className="btn" disabled={!!note.rest} onClick={() => nudge(1)}>半音 ↑</button>
                <button type="button" className="btn" disabled={!!note.rest} onClick={() => nudge(-1)}>半音 ↓</button>
                <button type="button" className="btn" disabled={!!note.rest} onClick={() => nudge(12)}>オクターブ ↑</button>
                <button type="button" className="btn" disabled={!!note.rest} onClick={() => nudge(-12)}>オクターブ ↓</button>
                <button type="button" className="btn" onClick={flipRest}>
                  {note.rest ? '音にする' : '休符にする'}
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={!canSplit(song, selection)}
                  onClick={() => apply(splitNote(song, selection))}
                >
                  半分に分ける
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={!canMerge(song, selection)}
                  onClick={() => apply(mergeWithNext(song, selection))}
                >
                  次とくっつける
                </button>
                <button type="button" className="btn" onClick={() => setSelection(null)}>選択を外す</button>
              </div>
              {note.rest && (
                <p className="sv-edit__hint">
                  「音にする」の高さは、直前の音と同じです（なければ {midiToNoteName(pitchBefore(song, selection, 60))}）。
                </p>
              )}
            </>
          )}

          {chordSel && chord && (
            <>
              <p className="sv-edit__title">コード · {chordSel.bar + 1}小節目 · {chordSymbolName(chord)}</p>
              <div className="sv-edit__buttons">
                <label className="sv-field">
                  根音
                  <select
                    value={chord.rootId}
                    onChange={(e) =>
                      apply(setChord(song, chordSel.bar, { rootId: e.target.value as typeof chord.rootId }))
                    }
                  >
                    {CHORD_ROOT_DEFS.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="sv-field">
                  種類
                  <select
                    value={chord.quality}
                    onChange={(e) =>
                      apply(setChord(song, chordSel.bar, { quality: e.target.value as ChordQuality }))
                    }
                  >
                    {(Object.keys(CHORD_QUALITY_LABELS) as ChordQuality[]).map((q) => (
                      <option key={q} value={q}>
                        {CHORD_QUALITY_LABELS[q]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="sv-field">
                  弾き方
                  <select
                    value={chord.playStyle ?? 'block'}
                    onChange={(e) =>
                      apply(
                        setChord(song, chordSel.bar, {
                          playStyle: e.target.value as ConcreteChordPlayStyle,
                        }),
                      )
                    }
                  >
                    {EDIT_STYLES.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="btn"
                  onClick={() => apply(fitBarToChord(song, chordSel.bar, keyRoot, scale))}
                >
                  メロディをこのコードに合わせる
                </button>
                <button type="button" className="btn" onClick={() => move(-1)}>◀ 前の小節</button>
                <button type="button" className="btn" onClick={() => move(1)}>次の小節 ▶</button>
                <button type="button" className="btn" onClick={() => setSelection(null)}>選択を外す</button>
              </div>
            </>
          )}
        </footer>
      </div>
    </div>
  )
}

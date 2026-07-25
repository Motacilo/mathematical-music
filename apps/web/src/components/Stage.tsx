import { useEffect, useState } from 'react'
import { KEY_NAMES, keyOptionLabel, midiToNoteName } from '../core/scale'
import type { Phrase } from '../core/types'
import { PhraseRoll } from './PhraseRoll'
import './Stage.css'

/** Cumulative measure label for a phrase block on the stage. */
function measureRangeLabel(phrases: Phrase[], index: number): string {
  let start = 1
  for (let i = 0; i < index; i++) {
    start += Math.max(1, phrases[i]!.bars || 1)
  }
  const len = Math.max(1, phrases[index]!.bars || 1)
  const end = start + len - 1
  return len === 1 ? `小節 ${start}` : `小節 ${start}–${end}`
}

function parsePositiveBpm(raw: string, fallback: number): number {
  const trimmed = raw.trim()
  const n = Number(trimmed)
  if (trimmed === '' || !Number.isFinite(n) || n <= 0) return fallback
  return Math.round(n)
}

function MeasureTune({
  phrase,
  onKeyChange,
  onBpmChange,
}: {
  phrase: Phrase
  onKeyChange: (keyRoot: number) => void
  onBpmChange: (bpm: number) => void
}) {
  const [bpmInput, setBpmInput] = useState(String(phrase.bpm))

  useEffect(() => {
    setBpmInput(String(phrase.bpm))
  }, [phrase.bpm, phrase.id])

  const commitBpm = () => {
    const bpm = parsePositiveBpm(bpmInput, phrase.bpm)
    setBpmInput(String(bpm))
    if (bpm !== phrase.bpm) onBpmChange(bpm)
  }

  return (
    <div className="stage__tune">
      <label>
        キー
        <select
          value={phrase.keyRoot}
          onChange={(e) => onKeyChange(Number(e.target.value))}
        >
          {KEY_NAMES.map((name, i) => (
            <option key={name} value={i}>
              {keyOptionLabel(i)}
            </option>
          ))}
        </select>
      </label>
      <label>
        BPM
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={bpmInput}
          onChange={(e) => {
            const next = e.target.value
            if (next === '' || /^\d+$/.test(next)) setBpmInput(next)
          }}
          onBlur={commitBpm}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
        />
      </label>
    </div>
  )
}

interface StageProps {
  phrases: Phrase[]
  selected: { phraseIndex: number; noteIndex: number } | null
  onSelect: (phraseIndex: number, noteIndex: number) => void
  onChangePitch: (phraseIndex: number, noteIndex: number, delta: number) => void
  onRemove: (phraseIndex: number) => void
  onMove: (phraseIndex: number, dir: -1 | 1) => void
  onPhraseKeyChange: (phraseIndex: number, keyRoot: number) => void
  onPhraseBpmChange: (phraseIndex: number, bpm: number) => void
  onPlayPhrase: (phraseIndex: number) => void
}

export function Stage({
  phrases,
  selected,
  onSelect,
  onChangePitch,
  onRemove,
  onMove,
  onPhraseKeyChange,
  onPhraseBpmChange,
  onPlayPhrase,
}: StageProps) {
  if (phrases.length === 0) {
    return (
      <div className="stage stage--empty">
        <p className="stage__empty-title">譜面はまだ空です</p>
        <p>
          上の候補から「譜面へ」を押すと、小節ごとにここに並びます。←→
          で並べ替え、音符をクリックして高さを変えられます。
        </p>
        <p className="stage__empty-tip">
          メロディができたら、右上の「譜面を再生」や MIDI / WAV で書き出してください。
        </p>
      </div>
    )
  }

  const selectedNote =
    selected != null
      ? phrases[selected.phraseIndex]?.notes[selected.noteIndex]
      : null

  return (
    <div className="stage">
      <div className="stage-wrap">
        <ol className="stage__list">
          {phrases.map((phrase, pi) => (
            <li key={phrase.id} className="stage__item">
              <div className="stage__item-meta">
                <span className="stage__item-title">
                  {measureRangeLabel(phrases, pi)}
                </span>
                <div className="stage__item-actions">
                  <button
                    type="button"
                    className="stage__item-play"
                    onClick={() => onPlayPhrase(pi)}
                  >
                    再生
                  </button>
                  <button
                    type="button"
                    disabled={pi === 0}
                    onClick={() => onMove(pi, -1)}
                    aria-label="左へ"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    disabled={pi === phrases.length - 1}
                    onClick={() => onMove(pi, 1)}
                    aria-label="右へ"
                  >
                    →
                  </button>
                  <button type="button" onClick={() => onRemove(pi)}>
                    削除
                  </button>
                </div>
              </div>
              <MeasureTune
                phrase={phrase}
                onKeyChange={(keyRoot) => onPhraseKeyChange(pi, keyRoot)}
                onBpmChange={(bpm) => onPhraseBpmChange(pi, bpm)}
              />
              <PhraseRoll
                phrase={phrase}
                editable
                selectedNoteIndex={
                  selected?.phraseIndex === pi ? selected.noteIndex : null
                }
                onSelectNote={(ni) => onSelect(pi, ni)}
              />
            </li>
          ))}
        </ol>
      </div>

      {selected != null && selectedNote && !selectedNote.rest && (
        <div className="stage__editor">
          <span className="stage__editor-label">
            {measureRangeLabel(phrases, selected.phraseIndex)}・音{' '}
            {midiToNoteName(selectedNote.pitch)}
          </span>
          <div className="stage__editor-btns">
            <button
              type="button"
              onClick={() =>
                onChangePitch(selected.phraseIndex, selected.noteIndex, 1)
              }
            >
              上げる ↑
            </button>
            <button
              type="button"
              onClick={() =>
                onChangePitch(selected.phraseIndex, selected.noteIndex, -1)
              }
            >
              下げる ↓
            </button>
            <span className="stage__editor-hint">
              ±1半音:{' '}
              {midiToNoteName(selectedNote.pitch + 1)} /{' '}
              {midiToNoteName(selectedNote.pitch - 1)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

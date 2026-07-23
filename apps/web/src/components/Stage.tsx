import { KEY_NAMES, midiToNoteName } from '../core/scale'
import type { Phrase } from '../core/types'
import { PhraseRoll } from './PhraseRoll'
import './Stage.css'

function keyLabel(keyRoot: number, scale: Phrase['scale']): string {
  const name = KEY_NAMES[((keyRoot % 12) + 12) % 12]!
  return `${name} ${scale === 'major' ? 'major' : 'minor'}`
}

interface StageProps {
  phrases: Phrase[]
  selected: { phraseIndex: number; noteIndex: number } | null
  onSelect: (phraseIndex: number, noteIndex: number) => void
  onChangePitch: (phraseIndex: number, noteIndex: number, delta: number) => void
  onRemove: (phraseIndex: number) => void
  onMove: (phraseIndex: number, dir: -1 | 1) => void
}

export function Stage({
  phrases,
  selected,
  onSelect,
  onChangePitch,
  onRemove,
  onMove,
}: StageProps) {
  if (phrases.length === 0) {
    return (
      <div className="stage stage--empty">
        <p>候補から「譜面へ」でフレーズを並べ、メロディを組み立てます。</p>
      </div>
    )
  }

  const selectedNote =
    selected != null
      ? phrases[selected.phraseIndex]?.notes[selected.noteIndex]
      : null

  return (
    <div className="stage">
      <ol className="stage__list">
        {phrases.map((phrase, pi) => (
          <li key={phrase.id} className="stage__item">
            <div className="stage__item-meta">
              <span className="stage__item-title">
                小節 {pi + 1}
                <span className="stage__item-tags">
                  BPM {phrase.bpm} · {keyLabel(phrase.keyRoot, phrase.scale)}
                </span>
              </span>
              <div className="stage__item-actions">
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

      {selected != null && selectedNote && !selectedNote.rest && (
        <div className="stage__editor">
          <span className="stage__editor-label">
            小節 {selected.phraseIndex + 1}・音{' '}
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

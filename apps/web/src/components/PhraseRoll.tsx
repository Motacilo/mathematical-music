import { DURATION_BEATS } from '../core/rhythm'
import { midiToNoteName } from '../core/scale'
import type { Note, Phrase } from '../core/types'
import './PhraseRoll.css'

interface PhraseRollProps {
  phrase: Phrase
  editable?: boolean
  selectedNoteIndex?: number | null
  onSelectNote?: (index: number) => void
  pitchMin?: number
  pitchMax?: number
}

function soundingPitches(notes: Note[]): number[] {
  return notes.filter((n) => !n.rest).map((n) => n.pitch)
}

export function PhraseRoll({
  phrase,
  editable = false,
  selectedNoteIndex = null,
  onSelectNote,
  pitchMin,
  pitchMax,
}: PhraseRollProps) {
  const pitches = soundingPitches(phrase.notes)
  const minP =
    pitchMin ?? (pitches.length ? Math.min(...pitches) - 2 : 60)
  const maxP =
    pitchMax ?? (pitches.length ? Math.max(...pitches) + 2 : 72)
  const range = Math.max(1, maxP - minP)

  const bars = Math.max(1, phrase.bars || 1)
  const totalBeats = Math.max(
    1,
    phrase.notes.reduce((s, n) => s + DURATION_BEATS[n.duration], 0),
  )
  const beatPct = 100 / totalBeats

  let beat = 0

  return (
    <div
      className={`phrase-roll${bars > 1 ? ' phrase-roll--multi' : ''}`}
      role="img"
      aria-label={`${bars}小節のフレーズ`}
      style={{ ['--beat-pct' as string]: `${beatPct}%` }}
    >
      {bars > 1 &&
        Array.from({ length: bars - 1 }, (_, i) => (
          <div
            key={`bar-${i}`}
            className="phrase-roll__barline"
            style={{ left: `${((i + 1) / bars) * 100}%` }}
            aria-hidden
          />
        ))}
      <div className="phrase-roll__grid">
        {phrase.notes.map((note, i) => {
          const w = (DURATION_BEATS[note.duration] / totalBeats) * 100
          const left = (beat / totalBeats) * 100
          beat += DURATION_BEATS[note.duration]

          if (note.rest) {
            return (
              <div
                key={i}
                className="phrase-roll__rest"
                style={{ left: `${left}%`, width: `${w}%` }}
                title="休符"
              />
            )
          }

          const top = ((maxP - note.pitch) / range) * 100
          const selected = selectedNoteIndex === i

          return (
            <button
              key={i}
              type="button"
              className={`phrase-roll__note${selected ? ' is-selected' : ''}${editable ? ' is-editable' : ''}`}
              style={{
                left: `${left}%`,
                width: `${w}%`,
                top: `${top}%`,
              }}
              title={midiToNoteName(note.pitch)}
              disabled={!editable}
              onClick={() => onSelectNote?.(i)}
            />
          )
        })}
      </div>
    </div>
  )
}

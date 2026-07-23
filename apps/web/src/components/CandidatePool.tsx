import type { Phrase } from '../core/types'
import { PhraseRoll } from './PhraseRoll'
import './CandidatePool.css'

interface CandidatePoolProps {
  candidates: Phrase[]
  onPreview: (phrase: Phrase) => void
  onAdd: (phrase: Phrase) => void
}

export function CandidatePool({
  candidates,
  onPreview,
  onAdd,
}: CandidatePoolProps) {
  if (candidates.length === 0) {
    return (
      <div className="candidate-pool candidate-pool--empty">
        <p>モードを選んで「生成」を押すと、1小節フレーズがここに並びます。</p>
      </div>
    )
  }

  return (
    <div className="candidate-pool">
      {candidates.map((phrase, i) => (
        <article key={phrase.id} className="candidate-card">
          <header className="candidate-card__head">
            <span>候補 {i + 1}</span>
            <div className="candidate-card__actions">
              <button type="button" onClick={() => onPreview(phrase)}>
                聴く
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => onAdd(phrase)}
              >
                譜面へ
              </button>
            </div>
          </header>
          <PhraseRoll phrase={phrase} />
        </article>
      ))}
    </div>
  )
}

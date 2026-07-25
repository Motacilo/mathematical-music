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
      <div className="candidate-pool-wrap">
        <div className="candidate-pool candidate-pool--empty">
          <p className="candidate-pool__empty-title">まだ候補がありません</p>
          <p>
            上の設定でモードとキーを選び、「生成」を押すと、フレーズ候補（1〜4小節）がここに並びます。
          </p>
          <p className="candidate-pool__empty-tip">
            1〜2小節は細い枠・最大8件、3〜4小節は2枠分の幅・最大4件。「譜面へ」で小節ごとに追加されます。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="candidate-pool-wrap">
      <div className="candidate-pool">
        {candidates.map((phrase, i) => {
          const isWide = phrase.bars >= 3
          return (
            <article
              key={phrase.id}
              className={`candidate-card${isWide ? ' candidate-card--wide' : ''}`}
            >
              <header className="candidate-card__head">
                <span className="candidate-card__label">候補 {i + 1}</span>
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
          )
        })}
      </div>
    </div>
  )
}

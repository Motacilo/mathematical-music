import { PlayStopButton } from './PlayStopButton'
import type { Phrase } from '../core/types'
import { PhraseRoll } from './PhraseRoll'
import './CandidatePool.css'

interface CandidatePoolProps {
  candidates: Phrase[]
  favoritedIds: Set<string>
  onPreview: (phrase: Phrase) => void
  onAdd: (phrase: Phrase) => void
  onFavorite: (phrase: Phrase) => void
  /** Open arrange modal for this candidate */
  onArrange?: (phrase: Phrase) => void
}

export function CandidatePool({
  candidates,
  favoritedIds,
  onPreview,
  onAdd,
  onFavorite,
  onArrange,
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
            枠の最小幅を保ったまま列数が変わります。1〜2小節は最大8件、3〜4小節は最大4件。「譜面へ」で小節ごとに追加されます。カードをタップするとちょいアレンジ案が開きます。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="candidate-pool-wrap">
      <div className="candidate-pool">
        {candidates.map((phrase, i) => {
          const favorited = favoritedIds.has(phrase.id)
          return (
            <article
              key={phrase.id}
              className={`candidate-card${onArrange ? ' candidate-card--arrangeable' : ''}`}
              onClick={onArrange ? () => onArrange(phrase) : undefined}
              onKeyDown={
                onArrange
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onArrange(phrase)
                      }
                    }
                  : undefined
              }
              role={onArrange ? 'button' : undefined}
              tabIndex={onArrange ? 0 : undefined}
              title={onArrange ? 'タップでちょいアレンジ' : undefined}
            >
              <header className="candidate-card__head">
                <span className="candidate-card__label">候補 {i + 1}</span>
                <div
                  className="candidate-card__actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <PlayStopButton
                    label="聴く"
                    onPlay={() => onPreview(phrase)}
                  />
                  {onArrange && (
                    <button type="button" onClick={() => onArrange(phrase)}>
                      アレンジ
                    </button>
                  )}
                  <button
                    type="button"
                    className={`fav${favorited ? ' is-saved' : ''}`}
                    onClick={() => onFavorite(phrase)}
                    disabled={favorited}
                    title={favorited ? 'お気に入り済' : 'お気に入りに追加'}
                  >
                    ★
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

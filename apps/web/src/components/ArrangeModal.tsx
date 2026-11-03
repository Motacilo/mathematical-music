import type { ReactNode } from 'react'
import { PlayStopButton } from './PlayStopButton'
import './ArrangeModal.css'

export interface ArrangeModalItem {
  id: string
  label: string
}

interface ArrangeModalProps<T extends ArrangeModalItem> {
  title?: string
  sourceTitle?: string
  sourcePreview: ReactNode
  variants: T[]
  onClose: () => void
  onRefresh: () => void
  onPreview: (item: T) => void
  onAdd: (item: T) => void
  renderVariant: (item: T) => ReactNode
}

export function ArrangeModal<T extends ArrangeModalItem>({
  title = 'ちょいアレンジ',
  sourceTitle = '元の候補',
  sourcePreview,
  variants,
  onClose,
  onRefresh,
  onPreview,
  onAdd,
  renderVariant,
}: ArrangeModalProps<T>) {
  return (
    <div
      className="arrange-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="arrange-modal-title"
      onClick={onClose}
    >
      <div
        className="arrange-modal__panel"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="arrange-modal__head">
          <h3 id="arrange-modal-title" className="arrange-modal__title">
            {title}
          </h3>
          <div className="arrange-modal__head-actions">
            <button type="button" className="btn" onClick={onRefresh}>
              別の案
            </button>
            <button type="button" className="btn" onClick={onClose}>
              閉じる
            </button>
          </div>
        </header>
        <p className="arrange-modal__lead">
          数音だけ変えた案や、全体の高さを ±1〜3
          ずらした案をランダムに出しています。
        </p>

        <section className="arrange-modal__source">
          <h4 className="arrange-modal__section-title">{sourceTitle}</h4>
          <div className="arrange-modal__source-body">{sourcePreview}</div>
        </section>

        <section className="arrange-modal__variants">
          <h4 className="arrange-modal__section-title">アレンジ候補</h4>
          {variants.length === 0 ? (
            <p className="arrange-modal__empty">アレンジ案を作れませんでした。</p>
          ) : (
            <ul className="arrange-modal__list">
              {variants.map((v, i) => (
                <li key={v.id} className="arrange-modal__item">
                  <div className="arrange-modal__item-head">
                    <span className="arrange-modal__item-label">
                      {i + 1}. {v.label}
                    </span>
                    <div className="arrange-modal__item-actions">
                      <PlayStopButton
                        label="聴く"
                        onPlay={() => onPreview(v)}
                      />
                      <button
                        type="button"
                        className="primary"
                        onClick={() => onAdd(v)}
                      >
                        譜面へ
                      </button>
                    </div>
                  </div>
                  <div className="arrange-modal__item-body">
                    {renderVariant(v)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

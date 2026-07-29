import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { playPhrase, playPhrases, stopPlayback } from '../audio/player'
import { AppFooter } from '../components/AppFooter'
import { PhraseRoll } from '../components/PhraseRoll'
import {
  formatSavedAt,
  listFavorites,
  listScores,
  removeFavorite,
  removeScore,
  setPendingAppend,
  type FavoriteEntry,
  type ScoreEntry,
} from '../core/libraryStore'
import { splitPhraseIntoBars } from '../core/phraseSplit'
import { keyOptionLabel } from '../core/scale'
import './ComposerPage.css'
import './LibraryPage.css'

type Tab = 'favorites' | 'scores'

export default function LibraryPage() {
  const navigate = useNavigate()
  const { tab: tabParam } = useParams()
  const tab: Tab = tabParam === 'scores' ? 'scores' : 'favorites'
  const [favorites, setFavorites] = useState(listFavorites)
  const [scores, setScores] = useState(listScores)
  const [playing, setPlaying] = useState(false)

  const refresh = useCallback(() => {
    setFavorites(listFavorites())
    setScores(listScores())
  }, [])

  const handleStop = async () => {
    await stopPlayback()
    setPlaying(false)
  }

  const previewPhrase = async (entry: FavoriteEntry) => {
    setPlaying(true)
    await playPhrase(entry.phrase, () => setPlaying(false))
  }

  const previewScore = async (entry: ScoreEntry) => {
    setPlaying(true)
    await playPhrases(entry.phrases, () => setPlaying(false))
  }

  const appendFavorite = (entry: FavoriteEntry) => {
    // Prefer the whole favorite as one unit if already bar-split storage;
    // multi-bar favorites are stored as one Phrase → split into measures.
    const bars = splitPhraseIntoBars(entry.phrase)
    setPendingAppend(bars)
    navigate('/')
  }

  const appendScore = (entry: ScoreEntry) => {
    setPendingAppend(entry.phrases)
    navigate('/')
  }

  const deleteFavorite = (id: string) => {
    if (!window.confirm('このお気に入りを削除しますか？')) return
    removeFavorite(id)
    refresh()
  }

  const deleteScore = (id: string) => {
    if (!window.confirm('この保存譜面を削除しますか？')) return
    removeScore(id)
    refresh()
  }

  return (
    <div className="app library">
      <header className="app__header">
        <div className="app__header-top">
          <p className="app__brand">なんとなく作曲</p>
          <nav className="app__nav">
            <Link to="/" className="app__nav-link">
              作曲へ戻る
            </Link>
          </nav>
        </div>
        <h1>ライブラリ</h1>
        <p className="app__lead">
          お気に入りの候補と、保存した譜面を確認・呼び出しできます（このブラウザに保存）。
        </p>
      </header>

      <div className="library__tabs">
        <Link
          to="/library/favorites"
          className={`library__tab${tab === 'favorites' ? ' is-active' : ''}`}
        >
          お気に入り（{favorites.length}）
        </Link>
        <Link
          to="/library/scores"
          className={`library__tab${tab === 'scores' ? ' is-active' : ''}`}
        >
          保存した譜面（{scores.length}）
        </Link>
        {playing && (
          <button type="button" className="btn" onClick={() => void handleStop()}>
            停止
          </button>
        )}
      </div>

      {tab === 'favorites' && (
        <section className="app__section">
          {favorites.length === 0 ? (
            <p className="library__empty">
              まだお気に入りがありません。作曲画面の候補で「★」を押すとここに入ります。
            </p>
          ) : (
            <div className="library__fav-grid">
              {favorites.map((entry) => (
                <article key={entry.id} className="library__card">
                  <header className="library__card-head">
                    <div>
                      <strong>
                        {entry.phrase.bars}小節 ·{' '}
                        {keyOptionLabel(entry.phrase.keyRoot)} · BPM{' '}
                        {entry.phrase.bpm}
                      </strong>
                      <p className="library__meta">
                        {formatSavedAt(entry.savedAt)}
                      </p>
                    </div>
                    <div className="library__card-actions">
                      <button
                        type="button"
                        onClick={() => void previewPhrase(entry)}
                      >
                        聴く
                      </button>
                      <button
                        type="button"
                        className="primary"
                        onClick={() => appendFavorite(entry)}
                      >
                        譜面に追加
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => deleteFavorite(entry.id)}
                      >
                        削除
                      </button>
                    </div>
                  </header>
                  <PhraseRoll phrase={entry.phrase} />
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'scores' && (
        <section className="app__section app__section--score">
          {scores.length === 0 ? (
            <p className="library__empty library__empty--score">
              まだ保存した譜面がありません。作曲画面の「譜面を保存」から追加できます。
            </p>
          ) : (
            <div className="library__score-list">
              {scores.map((entry) => (
                <article key={entry.id} className="library__score-card">
                  <header className="library__card-head">
                    <div>
                      <strong>{entry.name}</strong>
                      <p className="library__meta">
                        {entry.phrases.length}小節 · {formatSavedAt(entry.savedAt)}
                      </p>
                    </div>
                    <div className="library__card-actions">
                      <button
                        type="button"
                        onClick={() => void previewScore(entry)}
                      >
                        聴く
                      </button>
                      <button
                        type="button"
                        className="primary"
                        onClick={() => appendScore(entry)}
                      >
                        譜面に追加
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => deleteScore(entry.id)}
                      >
                        削除
                      </button>
                    </div>
                  </header>
                  <div className="library__score-rolls">
                    {entry.phrases.map((ph) => (
                      <div key={ph.id} className="library__score-roll">
                        <PhraseRoll phrase={ph} />
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
      <AppFooter />
    </div>
  )
}

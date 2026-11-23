import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { playLayers } from '../audio/player'
import { usePlayback } from '../audio/usePlayback'
import { AppFooter } from '../components/AppFooter'
import { PlayStopButton } from '../components/PlayStopButton'
import { TonePicker } from '../components/TonePicker'
import { VolumeMixer } from '../components/VolumeMixer'
import { useProject } from '../core/ProjectContext'
import { moodById, MOODS, type MoodId } from '../core/mood/presets'
import {
  generateFullSong,
  generateSectionCandidates,
  type SectionCandidate,
} from '../core/sections/generate'
import {
  SECTION_BAR_OPTIONS,
  SECTION_ROLES,
  sectionRoleLabel,
  sectionRoleMeta,
  suggestNextRole,
  type SectionRole,
} from '../core/sections/roles'
import {
  contentBarCount,
  longestBarEdges,
  sectionIdAtElapsed,
  sliceChords,
  sliceDrums,
  slicePhrases,
} from '../core/sections/timeline'
import './ComposerPage.css'
import './LayerPages.css'
import './SectionsPage.css'
import './StartPage.css'

export default function StartPage() {
  const {
    draft,
    beginWithMood,
    appendSongSection,
    replaceWithFullSong,
    replaceSongSection,
    removeSongSection,
    clearSongSections,
    setTones,
  } = useProject()
  const { playing, stop } = usePlayback()
  const [role, setRole] = useState<SectionRole>(() =>
    suggestNextRole(draft.sections.at(-1)?.role ?? null),
  )
  const [bars, setBars] = useState(() => sectionRoleMeta(role).defaultBars)
  const [candidates, setCandidates] = useState<SectionCandidate[] | null>(null)
  const [replaceId, setReplaceId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const followRef = useRef<number | null>(null)

  const stopFollow = () => {
    if (followRef.current != null) {
      cancelAnimationFrame(followRef.current)
      followRef.current = null
    }
  }

  useEffect(() => {
    if (playing) return
    stopFollow()
    setPlayingId(null)
    setActiveSectionId(null)
  }, [playing])

  useEffect(() => {
    if (!activeSectionId) return
    document.getElementById(`song-section-${activeSectionId}`)?.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth',
    })
  }, [activeSectionId])

  const totalBars = contentBarCount(draft)
  const songEmpty = totalBars === 0 && draft.sections.length === 0
  const mood = draft.moodId ? moodById(draft.moodId) : null
  const replaceTarget = draft.sections.find((s) => s.id === replaceId) ?? null

  const selectMood = (id: MoodId) => {
    if (id === draft.moodId) return
    const next = moodById(id)
    if (!songEmpty) {
      const ok = window.confirm(
        `雰囲気を「${next.label}」にすると、いまの曲は消えて、速さもそれに合わせます。よろしいですか？`,
      )
      if (!ok) return
    }
    void stop()
    setCandidates(null)
    setReplaceId(null)
    setRole('intro')
    setBars(sectionRoleMeta('intro').defaultBars)
    beginWithMood(next)
  }

  const chooseRole = (next: SectionRole) => {
    setRole(next)
    if (!replaceTarget) setBars(sectionRoleMeta(next).defaultBars)
    setCandidates(null)
  }

  const playBlock = async (
    id: string,
    block: {
      melody: SectionCandidate['melody']
      chords: SectionCandidate['chords']
      bass: SectionCandidate['bass']
      drums: SectionCandidate['drums']
    },
    highlightId: string | null = null,
  ) => {
    stopFollow()
    setActiveSectionId(highlightId)
    setPlayingId(id)
    try {
      await playLayers(block, draft.mixer, undefined, {
        chordPlayStyle: draft.chords.playStyle ?? 'block',
        tones: draft.tones,
      })
    } catch {
      setPlayingId(null)
      setActiveSectionId(null)
    }
  }

  const playSection = async (sectionId: string) => {
    const section = draft.sections.find((s) => s.id === sectionId)
    if (!section) return
    await playBlock(
      section.id,
      {
        melody: slicePhrases(draft.melody.stage, section.startBar, section.bars),
        chords: sliceChords(draft.chords.stage, section.startBar, section.bars),
        bass: slicePhrases(draft.bass.stage, section.startBar, section.bars),
        drums: sliceDrums(draft.drums.stage, section.startBar, section.bars),
      },
      section.id,
    )
  }

  const playAll = async () => {
    stopFollow()
    setPlayingId('all')
    try {
      const leadMs = await playLayers(
        {
          melody: draft.melody.stage,
          chords: draft.chords.stage,
          bass: draft.bass.stage,
          drums: draft.drums.stage,
        },
        draft.mixer,
        undefined,
        {
          chordPlayStyle: draft.chords.playStyle ?? 'block',
          tones: draft.tones,
        },
      )
      const edges = longestBarEdges(draft)
      const sections = draft.sections
      const origin = performance.now() + leadMs
      const tick = () => {
        const elapsed = (performance.now() - origin) / 1000
        const id = sectionIdAtElapsed(sections, edges, elapsed)
        setActiveSectionId((prev) => (prev === id ? prev : id))
        followRef.current = requestAnimationFrame(tick)
      }
      followRef.current = requestAnimationFrame(tick)
    } catch {
      stopFollow()
      setPlayingId(null)
      setActiveSectionId(null)
    }
  }

  const makeCandidates = () => {
    if (songEmpty && !mood) return
    void stop()
    setBusy(true)
    window.setTimeout(() => {
      try {
        setCandidates(
          generateSectionCandidates(
            role,
            bars,
            draft.meta.keyRoot,
            draft.meta.scale,
            draft.meta.bpm,
            undefined,
            mood,
          ),
        )
      } finally {
        setBusy(false)
      }
    }, 30)
  }

  const makeFullSong = () => {
    if (!mood) return
    if (!songEmpty) {
      const ok = window.confirm(
        'いまの曲を、イントロから後奏までの1曲に置き換えます。よろしいですか？',
      )
      if (!ok) return
    }
    void stop()
    setCandidates(null)
    setReplaceId(null)
    setBusy(true)
    window.setTimeout(() => {
      try {
        replaceWithFullSong(
          generateFullSong(
            draft.meta.keyRoot,
            draft.meta.scale,
            draft.meta.bpm,
            mood,
          ),
        )
      } finally {
        setBusy(false)
      }
    }, 30)
  }

  const adopt = (block: SectionCandidate) => {
    void stop()
    if (replaceTarget) {
      const replacedLast = draft.sections.at(-1)?.id === replaceTarget.id
      replaceSongSection(replaceTarget.id, block)
      setReplaceId(null)
      const next = suggestNextRole(
        replacedLast ? block.role : (draft.sections.at(-1)?.role ?? block.role),
      )
      setRole(next)
      setBars(sectionRoleMeta(next).defaultBars)
    } else {
      appendSongSection(block)
      const next = suggestNextRole(block.role)
      setRole(next)
      setBars(sectionRoleMeta(next).defaultBars)
    }
    setCandidates(null)
  }

  const beginReplace = (sectionId: string) => {
    const section = draft.sections.find((s) => s.id === sectionId)
    if (!section) return
    void stop()
    setReplaceId(sectionId)
    setRole(section.role)
    setBars(section.bars)
    setCandidates(null)
  }

  const cancelReplace = () => {
    setReplaceId(null)
    setCandidates(null)
    const next = suggestNextRole(draft.sections.at(-1)?.role ?? null)
    setRole(next)
    setBars(sectionRoleMeta(next).defaultBars)
  }

  const remove = (sectionId: string) => {
    const section = draft.sections.find((s) => s.id === sectionId)
    if (!section) return
    const ok = window.confirm(
      `${sectionRoleLabel(section.role)}（${section.bars}小節）を曲から外します。中の音も消えます。よろしいですか？`,
    )
    if (!ok) return
    void stop()
    removeSongSection(sectionId)
    if (replaceId === sectionId) cancelReplace()
  }

  const clearAll = () => {
    if (songEmpty) return
    const ok = window.confirm(
      '曲の区間と、メロディ・コード・ベース・リズムの譜面をすべて消します。雰囲気はそのままです。よろしいですか？',
    )
    if (!ok) return
    void stop()
    clearSongSections()
    setCandidates(null)
    setReplaceId(null)
    setRole('intro')
    setBars(sectionRoleMeta('intro').defaultBars)
  }

  const last = draft.sections[draft.sections.length - 1]
  const uncovered =
    draft.sections.length === 0
      ? totalBars
      : Math.max(0, totalBars - (last!.startBar + last!.bars)) +
        (draft.sections[0]?.startBar ?? 0)

  const needsMood = songEmpty && !mood

  return (
    <div className="app layer-page layer-page--start">
      <header className="app__header">
        <h1>曲をつくる</h1>
        <p className="app__lead">
          雰囲気を選んで、区間を足すか、おまかせでイントロから後奏まで一度に作ります。
          <br />
          聴いて気に入ったものを残し、あとから音だけ差し替えられます。
        </p>
        <ol className="app__steps">
          <li>
            <span className="app__step-num">1</span>
            雰囲気を選ぶ
          </li>
          <li>
            <span className="app__step-num">2</span>
            区間を足すか、おまかせで1曲作る
          </li>
          <li>
            <span className="app__step-num">3</span>
            気になるところはあとから直す
          </li>
        </ol>
      </header>

      <section className="app__section">
        <h2>雰囲気</h2>
        <div className="mood-grid" role="listbox" aria-label="雰囲気">
          {MOODS.map((item) => {
            const selected = item.id === draft.moodId
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={selected}
                className={`mood-card${selected ? ' is-selected' : ''}`}
                onClick={() => selectMood(item.id)}
              >
                <span className="mood-card__label">{item.label}</span>
                <span className="mood-card__blurb">{item.blurb}</span>
              </button>
            )
          })}
        </div>
        <p className="layer-hint">
          {mood
            ? `この曲は「${mood.label}」です。変えると、いまの曲は消えて最初からになります。`
            : songEmpty
              ? '先に雰囲気を選んでください。キーや速さは雰囲気に合わせます。'
              : '雰囲気が未設定です。選ぶと、この曲を消して最初から作ります。'}
        </p>
      </section>

      <section className="app__section">
        <h2>音色</h2>
        <p className="layer-hint">
          メロディ、コード、ベースの鳴り方です。次に聴くときから変わります。
        </p>
        <TonePicker tones={draft.tones} onChange={setTones} />
      </section>

      <section className="app__section">
        <h2>音量</h2>
        <p className="layer-hint">
          リズムを含め、パートごとの大きさです。次に聴くときから変わります。
        </p>
        <VolumeMixer />
      </section>

      <section className="app__section">
        <div className="app__section-head">
          <h2>いまの曲</h2>
          <div className="app__score-actions-row">
            <PlayStopButton
              label="通しで聴く"
              className="btn btn--score"
              disabled={totalBars === 0}
              onPlay={() => void playAll()}
            />
            <button
              type="button"
              className="btn btn--danger"
              disabled={songEmpty}
              onClick={clearAll}
            >
              曲を空にする
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={busy || !mood}
              title="イントロ、Aメロ、Bメロ、サビ、間奏、Aメロ、Bメロ、サビ、Cメロ、サビ、後奏の順で1曲作ります"
              onClick={makeFullSong}
            >
              {busy ? '生成しています…' : 'おまかせで1曲作る'}
            </button>
          </div>
        </div>
        {draft.sections.length === 0 ? (
          <p className="layer-hint">
            まだ区間がありません。最初はイントロがおすすめです。右上の「おまかせで1曲作る」で、イントロから後奏まで一度に作ることもできます。
            {totalBars > 0
              ? ` 先に入っている譜面が ${totalBars} 小節あります。新しい区間はそのうしろに足します。`
              : ''}
          </p>
        ) : (
          <ol className="section-list">
            {draft.sections.map((section, index) => {
              const active = playing && activeSectionId === section.id
              return (
                <li
                  key={section.id}
                  id={`song-section-${section.id}`}
                  className={`section-list__item${active ? ' is-playing' : ''}`}
                  aria-current={active ? 'true' : undefined}
                >
                  <div>
                    <p className="section-list__title">
                      {index + 1}. {sectionRoleLabel(section.role)}
                    </p>
                    <p className="section-list__meta">{section.bars}小節</p>
                  </div>
                  <div className="section-list__actions">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        if (active) {
                          void stop()
                          return
                        }
                        void playSection(section.id)
                      }}
                    >
                      {active ? '停止' : '聴く'}
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => beginReplace(section.id)}
                    >
                      差し替え
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger"
                      onClick={() => remove(section.id)}
                    >
                      外す
                    </button>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
        {draft.sections.length > 0 && uncovered > 0 && (
          <p className="layer-hint">
            区間に入っていない小節があります。音の高さや、同じ小節へのフレーズ差し替えは各タブでできます。
          </p>
        )}
        <p className="layer-hint">
          細かい修正は <Link to="/layer/melody">メロディ</Link>、
          <Link to="/layer/chords">コード</Link>、
          <Link to="/layer/bass">ベース</Link>、
          <Link to="/layer/drums">リズム</Link> から。
        </p>
      </section>

      <section className="app__section">
        <h2>
          {replaceTarget
            ? `${sectionRoleLabel(replaceTarget.role)}を差し替え`
            : '区間を足す'}
        </h2>
        {replaceTarget && (
          <p className="layer-hint">
            いまの{sectionRoleLabel(replaceTarget.role)}の位置に、選んだ候補を入れます。
            <button type="button" className="btn section-cancel" onClick={cancelReplace}>
              追加に戻る
            </button>
          </p>
        )}
        <div className="section-roles" role="listbox" aria-label="区間の種類">
          {SECTION_ROLES.map((item) => {
            const selected = item.id === role
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={selected}
                className={`section-role${selected ? ' is-selected' : ''}`}
                onClick={() => chooseRole(item.id)}
              >
                <span className="section-role__label">{item.label}</span>
                <span className="section-role__blurb">{item.blurb}</span>
              </button>
            )
          })}
        </div>
        <div className="start-actions">
          <label className="section-bars">
            小節数
            <select
              value={bars}
              onChange={(e) => {
                setBars(Number(e.target.value))
                setCandidates(null)
              }}
            >
              {SECTION_BAR_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn primary"
            disabled={busy || needsMood}
            onClick={makeCandidates}
          >
            {busy ? '用意しています…' : candidates ? '別の3つを出す' : '3つ出す'}
          </button>
        </div>
        <p className="layer-hint">
          {needsMood
            ? '雰囲気を選ぶと、ここで区間を出せます。'
            : 'イントロは静か、サビは高くて厚い、といった違いが出ます。小節数はここで変えられます。'}
        </p>
      </section>

      {candidates && (
        <section className="app__section">
          <h2>聴いて選ぶ</h2>
          <div className="sketch-grid">
            {candidates.map((block, index) => {
              const active = playing && playingId === block.id
              return (
                <article key={block.id} className="sketch-card">
                  <h3 className="sketch-card__title">
                    {sectionRoleLabel(block.role)} {index + 1}
                  </h3>
                  <p className="sketch-card__meta">{block.bars}小節</p>
                  <div className="sketch-card__actions">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        if (active) {
                          void stop()
                          return
                        }
                        void playBlock(block.id, block)
                      }}
                    >
                      {active ? '停止' : '聴く'}
                    </button>
                    <button
                      type="button"
                      className="btn primary"
                      onClick={() => adopt(block)}
                    >
                      {replaceTarget ? 'これに差し替える' : 'うしろに追加'}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}

      <AppFooter />
    </div>
  )
}

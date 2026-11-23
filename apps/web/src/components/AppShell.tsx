import { Suspense } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { usePlayback } from '../audio/usePlayback'
import { useProject } from '../core/ProjectContext'
import { LAYER_ROUTES } from '../core/projectTypes'
import { KEY_NAMES, keyOptionLabel } from '../core/scale'
import './AppShell.css'

function themeFromPath(pathname: string): string {
  if (pathname.includes('/start')) return 'theme-start'
  if (pathname.includes('/chords')) return 'theme-chords'
  if (pathname.includes('/bass')) return 'theme-bass'
  if (pathname.includes('/drums')) return 'theme-drums'
  if (pathname.includes('/arrange')) return 'theme-arrange'
  if (pathname.includes('/bgm')) return 'theme-bgm'
  return 'theme-melody'
}

function tabThemeClass(kind: string): string {
  switch (kind) {
    case 'start':
      return 'shell__tab--start'
    case 'chords':
      return 'shell__tab--chords'
    case 'bass':
      return 'shell__tab--bass'
    case 'drums':
      return 'shell__tab--drums'
    case 'arrange':
      return 'shell__tab--arrange'
    case 'bgm':
      return 'shell__tab--bgm'
    default:
      return 'shell__tab--melody'
  }
}

export function AppShell() {
  const { draft, setMeta } = useProject()
  const location = useLocation()
  const theme = themeFromPath(location.pathname)
  const hideTheoryMeta =
    location.pathname.includes('/start') || location.pathname.includes('/bgm')
  const { playing, stop } = usePlayback()

  return (
    <div className={`shell ${theme}`}>
      <header className="shell__top">
        <div className="shell__brand-row">
          <p className="shell__brand">なんとなく作曲</p>
          <nav className="shell__nav">
            {playing && (
              <button
                type="button"
                className="shell__stop"
                onClick={() => void stop()}
              >
                停止
              </button>
            )}
            <Link to="/library" className="shell__nav-link">
              ライブラリ
            </Link>
          </nav>
        </div>

        {!hideTheoryMeta && (
        <div className="shell__meta">
          <label>
            キー
            <select
              value={draft.meta.keyRoot}
              onChange={(e) =>
                setMeta({ keyRoot: Number(e.target.value) })
              }
            >
              {KEY_NAMES.map((_, i) => (
                <option key={i} value={i}>
                  {keyOptionLabel(i)}
                </option>
              ))}
            </select>
          </label>
          <label>
            スケール
            <select
              value={draft.meta.scale}
              onChange={(e) =>
                setMeta({
                  scale: e.target.value as 'major' | 'minor',
                })
              }
            >
              <option value="major">メジャー</option>
              <option value="minor">マイナー</option>
            </select>
          </label>
          <label>
            BPM
            <input
              type="number"
              min={40}
              max={240}
              value={draft.meta.bpm}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (Number.isFinite(n) && n > 0) setMeta({ bpm: Math.round(n) })
              }}
            />
          </label>
        </div>
        )}

        <nav className="shell__tabs" aria-label="レイヤ">
          {LAYER_ROUTES.map((tab) => {
            const active = location.pathname === tab.path
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={`shell__tab ${tabThemeClass(tab.kind)}${active ? ' is-active' : ''}`}
              >
                {tab.label}
              </Link>
            )
          })}
        </nav>
      </header>
      <Suspense fallback={<p className="app-loading">読み込み中…</p>}>
        <Outlet />
      </Suspense>
    </div>
  )
}

import { lazy, Suspense } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { PlaybackProvider } from './audio/PlaybackContext'
import { AppShell } from './components/AppShell'
import { ProjectProvider } from './core/ProjectContext'
import StartPage from './pages/StartPage'

const ArrangePage = lazy(() => import('./pages/ArrangePage'))
const BgmPage = lazy(() => import('./pages/BgmPage'))
const BassPage = lazy(() => import('./pages/BassPage'))
const ChordsPage = lazy(() => import('./pages/ChordsPage'))
const ComposerPage = lazy(() => import('./pages/ComposerPage'))
const DrumsPage = lazy(() => import('./pages/DrumsPage'))
const LibraryPage = lazy(() => import('./pages/LibraryPage'))
const LicensesPage = lazy(() => import('./pages/LicensesPage'))


export default function App() {
  return (
    <ProjectProvider>
      <PlaybackProvider>
        <HashRouter>
          <Suspense fallback={<p className="app-loading">読み込み中…</p>}>
          <Routes>
            <Route path="/" element={<Navigate to="/layer/start" replace />} />
            <Route path="/layer" element={<AppShell />}>
              <Route path="start" element={<StartPage />} />
              <Route path="sections" element={<Navigate to="/layer/start" replace />} />
              <Route path="melody" element={<ComposerPage />} />
              <Route path="chords" element={<ChordsPage />} />
              <Route path="bass" element={<BassPage />} />
              <Route path="drums" element={<DrumsPage />} />
              <Route path="autofill" element={<Navigate to="/layer/start" replace />} />
              <Route path="arrange" element={<ArrangePage />} />
              <Route path="bgm" element={<BgmPage />} />
            </Route>
            <Route path="/library" element={<Navigate to="/library/favorites" replace />} />
            <Route path="/library/:tab" element={<LibraryPage />} />
            <Route path="/licenses" element={<LicensesPage />} />
            <Route path="*" element={<Navigate to="/layer/melody" replace />} />
          </Routes>
          </Suspense>
        </HashRouter>
      </PlaybackProvider>
    </ProjectProvider>
  )
}

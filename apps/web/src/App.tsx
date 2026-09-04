import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { ProjectProvider } from './core/ProjectContext'
import ArrangePage from './pages/ArrangePage'
import BassPage from './pages/BassPage'
import ChordsPage from './pages/ChordsPage'
import ComposerPage from './pages/ComposerPage'
import DrumsPage from './pages/DrumsPage'
import LibraryPage from './pages/LibraryPage'

export default function App() {
  return (
    <ProjectProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/layer/melody" replace />} />
          <Route path="/layer" element={<AppShell />}>
            <Route path="melody" element={<ComposerPage />} />
            <Route path="chords" element={<ChordsPage />} />
            <Route path="bass" element={<BassPage />} />
            <Route path="drums" element={<DrumsPage />} />
            <Route path="arrange" element={<ArrangePage />} />
          </Route>
          <Route path="/library" element={<Navigate to="/library/favorites" replace />} />
          <Route path="/library/:tab" element={<LibraryPage />} />
          <Route path="*" element={<Navigate to="/layer/melody" replace />} />
        </Routes>
      </HashRouter>
    </ProjectProvider>
  )
}

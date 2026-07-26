import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import ComposerPage from './pages/ComposerPage'
import LibraryPage from './pages/LibraryPage'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<ComposerPage />} />
        <Route path="/library" element={<Navigate to="/library/favorites" replace />} />
        <Route path="/library/:tab" element={<LibraryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}

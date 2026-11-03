import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { prefetchEngine } from './audio/player'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Fetch the audio engine (Tone.js) once the first screen is up, so the first
// "聴く" press does not wait on the download.
const idle =
  window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500))
idle(() => prefetchEngine())

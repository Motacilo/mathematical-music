/**
 * Lightweight playback state shared by the UI and the lazily loaded engine.
 * Must not import Tone.js.
 */

/**
 * Silence before the first note. Synths are built before this clock starts,
 * so the delay only has to cover handing over the opening slice.
 */
export const PLAYBACK_START_DELAY_SEC = 0.15

type PlaybackListener = () => void
const playbackListeners = new Set<PlaybackListener>()
let playing = false

export function notifyPlayback(next: boolean): void {
  if (playing === next) return
  playing = next
  for (const listener of playbackListeners) listener()
}

/**
 * Subscribe for useSyncExternalStore.
 * Do not invoke the listener synchronously — React reads getSnapshot instead.
 */
export function subscribePlayback(onStoreChange: () => void): () => void {
  playbackListeners.add(onStoreChange)
  return () => {
    playbackListeners.delete(onStoreChange)
  }
}

export function getPlaybackSnapshot(): boolean {
  return playing
}

export function isPlaying(): boolean {
  return playing
}

import { useCallback, useSyncExternalStore } from 'react'
import {
  getPlaybackSnapshot,
  stopPlayback,
  subscribePlayback,
} from './player'

/**
 * Playback UI flag backed by the audio module store.
 * Survives tab changes; updates reliably via useSyncExternalStore.
 */
export function usePlayback() {
  const playing = useSyncExternalStore(
    subscribePlayback,
    getPlaybackSnapshot,
    () => false,
  )

  const stop = useCallback(async () => {
    await stopPlayback()
  }, [])

  return { playing, stop }
}

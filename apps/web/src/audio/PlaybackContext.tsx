import type { ReactNode } from 'react'

/** Kept for App.tsx compatibility — playback state uses useSyncExternalStore. */
export function PlaybackProvider({ children }: { children: ReactNode }) {
  return children
}

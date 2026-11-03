/**
 * Public playback API. The Tone.js engine (./engine) is loaded on first use
 * (and prefetched when the browser is idle) to keep it out of the initial bundle.
 */
import type * as Engine from './engine'

export type { LayerPlayback, PlayOptions } from './engine'
export {
  PLAYBACK_START_DELAY_SEC,
  getPlaybackSnapshot,
  isPlaying,
  subscribePlayback,
} from './playbackState'

let enginePromise: Promise<typeof Engine> | null = null

export function loadEngine(): Promise<typeof Engine> {
  if (!enginePromise) {
    enginePromise = import('./engine').catch((err: unknown) => {
      enginePromise = null
      throw err
    })
  }
  return enginePromise
}

/** Start downloading the engine in the background without blocking the UI. */
export function prefetchEngine(): void {
  void loadEngine().catch(() => {})
}

export async function ensureAudio(): Promise<void> {
  const e = await loadEngine()
  await e.ensureAudio()
}

export async function stopPlayback(): Promise<void> {
  // Nothing can be playing before the engine has loaded.
  if (!enginePromise) return
  const e = await enginePromise
  await e.stopPlayback()
}

export async function playLayers(
  ...args: Parameters<typeof Engine.playLayers>
): ReturnType<typeof Engine.playLayers> {
  return (await loadEngine()).playLayers(...args)
}

export async function playPhrases(
  ...args: Parameters<typeof Engine.playPhrases>
): ReturnType<typeof Engine.playPhrases> {
  return (await loadEngine()).playPhrases(...args)
}

export async function playPhrase(
  ...args: Parameters<typeof Engine.playPhrase>
): ReturnType<typeof Engine.playPhrase> {
  return (await loadEngine()).playPhrase(...args)
}

export async function playChordProgression(
  ...args: Parameters<typeof Engine.playChordProgression>
): ReturnType<typeof Engine.playChordProgression> {
  return (await loadEngine()).playChordProgression(...args)
}

export async function playDrumPhrase(
  ...args: Parameters<typeof Engine.playDrumPhrase>
): ReturnType<typeof Engine.playDrumPhrase> {
  return (await loadEngine()).playDrumPhrase(...args)
}

import type { MoodId } from '../mood/presets'
import type { ScaleType } from '../types'
import type { BgmSong } from './generate'
import { blockLabel, type BgmBlock, type BgmEnding } from './plan'

/** Everything the BGM tab shows. Lives for the browser session so switching tabs keeps it. */
export type BgmSession = {
  moodId: MoodId
  seconds: number
  bpm: number
  keyRoot: number
  scale: ScaleType
  blocks: BgmBlock[]
  /** Block ids in playing order */
  arrangement: string[]
  /** Chosen bar target when the length does not divide evenly */
  pickedTarget: number | null
  ending: BgmEnding
  song: BgmSong | null
  /** True when settings changed after `song` was made */
  stale: boolean
}

export function makeBlock(index: number, bars = 4): BgmBlock {
  return { id: `blk-${index}`, label: blockLabel(index), bars }
}

export function defaultBgmSession(): BgmSession {
  const a = makeBlock(0)
  const b = makeBlock(1)
  return {
    moodId: 'bright',
    seconds: 32,
    bpm: 120,
    keyRoot: 0,
    scale: 'major',
    blocks: [a, b],
    arrangement: [a.id, b.id, a.id, b.id],
    pickedTarget: null,
    ending: 'normal',
    song: null,
    stale: false,
  }
}

let current: BgmSession = defaultBgmSession()

export function readBgmSession(): BgmSession {
  return current
}

export function writeBgmSession(next: BgmSession): void {
  current = next
}

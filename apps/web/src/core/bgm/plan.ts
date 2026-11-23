/** Planning helpers for the short-video BGM tab: lengths, bars and block order. */

export const BGM_MIN_SECONDS = 10
export const BGM_MAX_SECONDS = 180
export const BGM_MIN_BPM = 40
export const BGM_MAX_BPM = 240
export const BGM_MAX_BLOCKS = 6
export const BGM_MIN_BLOCK_BARS = 1
export const BGM_MAX_BLOCK_BARS = 16

export type BgmEnding = 'normal' | 'loop' | 'hold'

export const BGM_ENDINGS: readonly { id: BgmEnding; label: string; blurb: string }[] = [
  { id: 'normal', label: 'そのまま', blurb: '終わり方は決めず、そのまま作ります' },
  {
    id: 'loop',
    label: '繰り返し',
    blurb: '最後を頭につなげやすい形にします。続けて流してもつながります',
  },
  {
    id: 'hold',
    label: '伸ばす',
    blurb: '1小節多く作って、最後の音を伸ばします。後半は休符です',
  },
]

export type BgmBlock = {
  id: string
  label: string
  bars: number
}

export function blockLabel(index: number): string {
  return 'ABCDEF'[index] ?? String(index + 1)
}

export function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}

export function barSeconds(bpm: number): number {
  return 240 / bpm
}

export function secondsOfBars(bars: number, bpm: number): number {
  return bars * barSeconds(bpm)
}

export type TargetBars = {
  /** seconds ÷ seconds-per-bar, before rounding */
  exact: number
  /** Bar counts that fit. One when it divides evenly, otherwise the lower and the higher. */
  options: number[]
}

/** Bars that fill `seconds` at `bpm` (4/4). Not divisible: the lower and the higher. */
export function targetBarOptions(seconds: number, bpm: number): TargetBars {
  const exact = seconds / barSeconds(bpm)
  const nearest = Math.round(exact)
  if (Math.abs(exact - nearest) < 1e-6) {
    return { exact, options: [Math.max(1, nearest)] }
  }
  const low = Math.max(1, Math.floor(exact))
  return { exact, options: low === Math.ceil(exact) ? [low] : [low, Math.ceil(exact)] }
}

export function arrangementBars(
  arrangement: readonly string[],
  blocks: readonly BgmBlock[],
): number {
  const byId = new Map(blocks.map((b) => [b.id, b.bars]))
  return arrangement.reduce((sum, id) => sum + (byId.get(id) ?? 0), 0)
}

export function formatSeconds(sec: number): string {
  if (sec < 60) return `${sec.toFixed(1).replace(/\.0$/, '')}秒`
  const m = Math.floor(sec / 60)
  const s = Math.round(sec - m * 60)
  return s === 60 ? `${m + 1}分` : `${m}分${s}秒`
}

import type { Duration, RhythmId } from './types'

export interface RhythmSlot {
  duration: Duration
  rest?: boolean
}

/** Duration in quarter-note beats (4/4 bar = 4). */
export const DURATION_BEATS: Record<Duration, number> = {
  '16n': 0.25,
  '8n': 0.5,
  '8n.': 0.75,
  '4n': 1,
  '4n.': 1.5,
  '2n': 2,
}

export const BAR_BEATS = 4

const FIXED_TEMPLATES: Partial<Record<RhythmId, RhythmSlot[]>> = {
  quarters: [
    { duration: '4n' },
    { duration: '4n' },
    { duration: '4n' },
    { duration: '4n' },
  ],
  eighths: Array.from({ length: 8 }, () => ({ duration: '8n' as Duration })),
  sixteenths: Array.from({ length: 16 }, () => ({
    duration: '16n' as Duration,
  })),
}

const MIXED_POOLS: Partial<Record<RhythmId, Duration[]>> = {
  mixed_16_8: ['16n', '8n'],
  mixed_8_4: ['8n', '4n'],
  mixed_16_4: ['16n', '4n'],
  mixed_16_8_4: ['16n', '8n', '4n'],
}

export const RHYTHM_LABELS: Record<RhythmId, string> = {
  quarters: '四分音符 × 4',
  eighths: '八分音符 × 8',
  sixteenths: '十六分音符 × 16',
  mixed_16_8: '混合（16・8）',
  mixed_8_4: '混合（8・4）',
  mixed_16_4: '混合（16・4）',
  mixed_16_8_4: '混合（16・8・4）',
}

/** restProbabilityPercent: 0 = never rest, 100 = always rest */
function maybeRest(restProbabilityPercent: number): boolean {
  const p = Math.max(0, Math.min(100, restProbabilityPercent)) / 100
  if (p <= 0) return false
  if (p >= 1) return true
  return Math.random() < p
}

function applyRandomRests(
  slots: RhythmSlot[],
  restProbabilityPercent: number,
): RhythmSlot[] {
  return slots.map((s) => ({
    ...s,
    rest: maybeRest(restProbabilityPercent) || undefined,
  }))
}

/** Build mixed rhythm: random durations from pool, drop anything that would overflow the bar. */
export function buildMixedSlots(
  pool: Duration[],
  restProbabilityPercent: number,
): RhythmSlot[] {
  const slots: RhythmSlot[] = []
  let beats = 0
  const maxSteps = 64
  for (let i = 0; i < maxSteps && beats < BAR_BEATS - 1e-9; i++) {
    const duration = pool[Math.floor(Math.random() * pool.length)]!
    const dur = DURATION_BEATS[duration]
    if (beats + dur > BAR_BEATS + 1e-9) {
      break
    }
    slots.push({
      duration,
      rest: maybeRest(restProbabilityPercent) || undefined,
    })
    beats += dur
  }
  if (slots.length === 0 && pool.length > 0) {
    const duration = pool.reduce((a, b) =>
      DURATION_BEATS[a] <= DURATION_BEATS[b] ? a : b,
    )
    if (DURATION_BEATS[duration] <= BAR_BEATS) {
      slots.push({
        duration,
        rest: maybeRest(restProbabilityPercent) || undefined,
      })
    }
  }
  return slots
}

/** Resolve rhythm slots for generation (mixed is randomized each call). */
export function resolveRhythmSlots(
  rhythmId: RhythmId,
  restProbabilityPercent: number,
): RhythmSlot[] {
  const pool = MIXED_POOLS[rhythmId]
  if (pool) {
    return buildMixedSlots(pool, restProbabilityPercent)
  }
  const fixed = FIXED_TEMPLATES[rhythmId]
  if (fixed) {
    return applyRandomRests(fixed, restProbabilityPercent)
  }
  return applyRandomRests(FIXED_TEMPLATES.eighths!, restProbabilityPercent)
}

export function countSoundingSlots(slots: RhythmSlot[]): number {
  return slots.filter((s) => !s.rest).length
}

export function phraseDurationBeats(slots: RhythmSlot[]): number {
  return slots.reduce((sum, s) => sum + DURATION_BEATS[s.duration], 0)
}

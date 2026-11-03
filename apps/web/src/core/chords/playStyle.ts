import { chordPitches } from './theory'
import type { ChordBar, ChordPlayStyleId } from '../projectTypes'

export type { ChordPlayStyleId }

export const CHORD_PLAY_STYLE_OPTIONS: {
  id: ChordPlayStyleId
  label: string
}[] = [
  { id: 'block', label: '同時押し' },
  { id: 'pulse', label: 'パルス（四分）' },
  { id: 'arp_up', label: 'アルペジオ↑' },
  { id: 'arp_down', label: 'アルペジオ↓' },
  { id: 'arp_wave', label: 'アルペジオ上下' },
  { id: 'broken', label: '分解（ルート→和音）' },
  { id: 'alberti', label: 'アルベルティ風' },
  { id: 'random', label: 'ランダム' },
]

const CONCRETE_STYLES: Exclude<ChordPlayStyleId, 'random'>[] = [
  'block',
  'pulse',
  'arp_up',
  'arp_down',
  'arp_wave',
  'broken',
  'alberti',
]

export type ChordPlayEvent = {
  /** MIDI pitches sounded together */
  pitches: number[]
  /** Start within the bar (beats, 0–4) */
  timeBeat: number
  /** Gate length in beats */
  durationBeats: number
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

export function resolveChordPlayStyle(
  style: ChordPlayStyleId,
): Exclude<ChordPlayStyleId, 'random'> {
  if (style === 'random') return pick(CONCRETE_STYLES)
  return style
}

function ensurePitches(bar: ChordBar): number[] {
  const pitches = chordPitches(bar)
  return pitches.length > 0 ? pitches : [60]
}

function expandBlock(pitches: number[]): ChordPlayEvent[] {
  return [{ pitches, timeBeat: 0, durationBeats: 3.8 }]
}

function expandPulse(pitches: number[]): ChordPlayEvent[] {
  return [0, 1, 2, 3].map((b) => ({
    pitches,
    timeBeat: b,
    durationBeats: 0.85,
  }))
}

function expandArp(
  pitches: number[],
  order: 'up' | 'down' | 'wave',
): ChordPlayEvent[] {
  let seq: number[]
  if (order === 'up') seq = [...pitches]
  else if (order === 'down') seq = [...pitches].reverse()
  else {
    const up = [...pitches]
    const down = [...pitches].reverse().slice(1)
    seq = [...up, ...down]
    if (seq.length === 0) seq = pitches
  }
  const step = 0.5 // eighths
  const events: ChordPlayEvent[] = []
  let i = 0
  for (let beat = 0; beat < 4 - 1e-9; beat += step) {
    const p = seq[i % seq.length]!
    events.push({
      pitches: [p],
      timeBeat: beat,
      durationBeats: step * 0.92,
    })
    i++
  }
  return events
}

function expandBroken(pitches: number[]): ChordPlayEvent[] {
  const root = pitches[0]!
  const upper = pitches.slice(1)
  return [
    { pitches: [root], timeBeat: 0, durationBeats: 1.85 },
    {
      pitches: upper.length > 0 ? upper : [root],
      timeBeat: 2,
      durationBeats: 1.85,
    },
  ]
}

/** low – high – mid – high (falls back for 2-note chords) */
function expandAlberti(pitches: number[]): ChordPlayEvent[] {
  const sorted = [...pitches].sort((a, b) => a - b)
  let pattern: number[]
  if (sorted.length >= 3) {
    const low = sorted[0]!
    const mid = sorted[Math.floor((sorted.length - 1) / 2)]!
    const high = sorted[sorted.length - 1]!
    pattern = [low, high, mid, high]
  } else if (sorted.length === 2) {
    pattern = [sorted[0]!, sorted[1]!, sorted[0]!, sorted[1]!]
  } else {
    pattern = [sorted[0]!, sorted[0]!, sorted[0]!, sorted[0]!]
  }
  return pattern.map((p, i) => ({
    pitches: [p],
    timeBeat: i,
    durationBeats: 0.9,
  }))
}

export function expandChordBarPlay(
  bar: ChordBar,
  style: Exclude<ChordPlayStyleId, 'random'>,
): ChordPlayEvent[] {
  const pitches = ensurePitches(bar)
  if (bar.sustain) return expandBlock(pitches)
  switch (style) {
    case 'block':
      return expandBlock(pitches)
    case 'pulse':
      return expandPulse(pitches)
    case 'arp_up':
      return expandArp(pitches, 'up')
    case 'arp_down':
      return expandArp(pitches, 'down')
    case 'arp_wave':
      return expandArp(pitches, 'wave')
    case 'broken':
      return expandBroken(pitches)
    case 'alberti':
      return expandAlberti(pitches)
  }
}

/** Expand a full progression; `random` picks a style per bar. */
export function expandChordProgressionPlay(
  chords: ChordBar[],
  style: ChordPlayStyleId,
): { barIndex: number; events: ChordPlayEvent[]; style: Exclude<ChordPlayStyleId, 'random'> }[] {
  return chords.map((bar, barIndex) => {
    const resolved = resolveChordPlayStyle(style)
    return {
      barIndex,
      style: resolved,
      events: expandChordBarPlay(bar, resolved),
    }
  })
}

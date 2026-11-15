import { chordPitches } from './theory'
import type {
  ChordBar,
  ChordPlayStyleId,
  ConcreteChordPlayStyle,
} from '../projectTypes'

export type { ChordPlayStyleId, ConcreteChordPlayStyle }

export const CHORD_PLAY_STYLE_OPTIONS: {
  id: ChordPlayStyleId
  label: string
}[] = [
  { id: 'auto', label: 'おまかせ（区間ごと）' },
  { id: 'block', label: '同時押し' },
  { id: 'pulse', label: 'パルス（四分）' },
  { id: 'arp_ring', label: 'アルペジオ（響かせる）' },
  { id: 'arp_pop', label: 'アルペジオ（ピアノ風）' },
  { id: 'arp_16', label: 'アルペジオ（16分）' },
  { id: 'arp_up', label: 'アルペジオ↑' },
  { id: 'arp_down', label: 'アルペジオ↓' },
  { id: 'arp_wave', label: 'アルペジオ上下' },
  { id: 'broken', label: '分解（ルート→和音）' },
  { id: 'alberti', label: 'アルベルティ風' },
  { id: 'random', label: 'ランダム（小節ごと）' },
]

export const CONCRETE_STYLES: ConcreteChordPlayStyle[] = [
  'block',
  'pulse',
  'arp_ring',
  'arp_pop',
  'arp_16',
  'arp_up',
  'arp_down',
  'arp_wave',
  'broken',
  'alberti',
]

export const ARPEGGIO_STYLES: readonly ConcreteChordPlayStyle[] = [
  'arp_ring',
  'arp_pop',
  'arp_16',
  'arp_up',
  'arp_down',
  'arp_wave',
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
): ConcreteChordPlayStyle {
  if (style === 'random') return pick(CONCRETE_STYLES)
  if (style === 'auto') return 'block'
  return style
}

/**
 * Style for one bar. A specific layer style applies to every bar; 'auto'
 * uses the bar's own style (set by おまかせ) and falls back to a held chord.
 */
export function styleForBar(
  bar: ChordBar,
  layerStyle: ChordPlayStyleId,
): ConcreteChordPlayStyle {
  if (layerStyle === 'auto') return bar.playStyle ?? 'block'
  return resolveChordPlayStyle(layerStyle)
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

/** Let each note ring until the end of the bar (at most `cap` beats). */
function ring(timeBeat: number, cap: number): number {
  return Math.max(0.4, Math.min(cap, 4 - timeBeat) - 0.05)
}

/** Up through the chord and its octave, back down, every note left ringing. */
function expandArpRing(pitches: number[]): ChordPlayEvent[] {
  const up = [...pitches, ...pitches.map((p) => p + 12)]
  const seq = [...up.slice(0, 6), up[4] ?? up[1]!, up[3] ?? up[0]!]
  return seq.map((p, i) => ({
    pitches: [p],
    timeBeat: i * 0.5,
    durationBeats: ring(i * 0.5, 2),
  }))
}

/** Pop-piano pattern: 1-5-8-3-5-3-8-5, root held through the bar. */
function expandArpPop(pitches: number[]): ChordPlayEvent[] {
  const [root, third, fifth] = [pitches[0]!, pitches[1] ?? pitches[0]!, pitches[2] ?? pitches[0]! + 7]
  const seq = [root, fifth, root + 12, third + 12, fifth + 12, third + 12, root + 12, fifth]
  return seq.map((p, i) => ({
    pitches: [p],
    timeBeat: i * 0.5,
    durationBeats: i === 0 ? 3.9 : ring(i * 0.5, 1.2),
  }))
}

/** Sixteenth-note ripple up and down over the chord plus its octave. */
function expandArp16(pitches: number[]): ChordPlayEvent[] {
  const tones = [...pitches, pitches[0]! + 12]
  const cycle = [...tones, ...tones.slice(1, -1).reverse()]
  const events: ChordPlayEvent[] = []
  for (let i = 0; i < 16; i++) {
    events.push({
      pitches: [cycle[i % cycle.length]!],
      timeBeat: i * 0.25,
      durationBeats: 0.24,
    })
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
  style: ConcreteChordPlayStyle,
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
    case 'arp_ring':
      return expandArpRing(pitches)
    case 'arp_pop':
      return expandArpPop(pitches)
    case 'arp_16':
      return expandArp16(pitches)
  }
}

/** Expand a full progression; `random` picks a style per bar. */
export function expandChordProgressionPlay(
  chords: ChordBar[],
  style: ChordPlayStyleId,
): { barIndex: number; events: ChordPlayEvent[]; style: ConcreteChordPlayStyle }[] {
  return chords.map((bar, barIndex) => {
    const resolved = styleForBar(bar, style)
    return {
      barIndex,
      style: resolved,
      events: expandChordBarPlay(bar, resolved),
    }
  })
}

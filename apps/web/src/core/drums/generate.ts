import type { DrumHit, DrumInstrument, DrumPhrase } from '../projectTypes'
import { uid } from '../chords/theory'

export type DrumStyleId =
  | 'four_on_floor'
  | 'eight_beat'
  | 'sixteen_beat'
  | 'rock'
  | 'half_time'
  | 'disco'
  | 'ballad'

export type DrumStyleSelect = DrumStyleId | 'any'

/** clean = 定番そのまま / light = ちょいアレンジ / mixed = 候補ごとに混在 */
export type DrumArrangeMode = 'clean' | 'light' | 'mixed'

export const DRUM_STYLE_OPTIONS: {
  id: DrumStyleSelect
  label: string
}[] = [
  { id: 'any', label: 'おまかせ' },
  { id: 'four_on_floor', label: '4つ打ち' },
  { id: 'eight_beat', label: 'エイトビート' },
  { id: 'sixteen_beat', label: '16ビート' },
  { id: 'rock', label: 'ロック' },
  { id: 'half_time', label: 'ハーフタイム' },
  { id: 'disco', label: 'ディスコ' },
  { id: 'ballad', label: 'バラード' },
]

export const DRUM_ARRANGE_OPTIONS: {
  id: DrumArrangeMode
  label: string
}[] = [
  { id: 'clean', label: '定番そのまま' },
  { id: 'light', label: 'ちょいアレンジ' },
  { id: 'mixed', label: '混在' },
]

export const DRUM_STYLE_LABELS: Record<DrumStyleId, string> = {
  four_on_floor: '4つ打ち',
  eight_beat: 'エイトビート',
  sixteen_beat: '16ビート',
  rock: 'ロック',
  half_time: 'ハーフタイム',
  disco: 'ディスコ',
  ballad: 'バラード',
}

type PatternDef = {
  id: DrumStyleId
  /** One bar in 4/4 (beats 0..4) */
  hits: DrumHit[]
}

const hit = (
  instrument: DrumInstrument,
  beat: number,
  duration: DrumHit['duration'] = '8n',
): DrumHit => ({ instrument, beat, duration })

function eighthHats(): DrumHit[] {
  const out: DrumHit[] = []
  for (let b = 0; b < 4; b += 0.5) {
    out.push(hit('hat', b, '8n'))
  }
  return out
}

function sixteenthHats(): DrumHit[] {
  const out: DrumHit[] = []
  for (let b = 0; b < 4; b += 0.25) {
    out.push(hit('hat', b, '16n'))
  }
  return out
}

function offbeatHats(): DrumHit[] {
  return [0.5, 1.5, 2.5, 3.5].map((b) => hit('hat', b, '8n'))
}

/** Canonical 1-bar patterns (beat 0 = 1拍目) */
const PATTERNS: PatternDef[] = [
  {
    id: 'four_on_floor',
    hits: [
      hit('kick', 0),
      hit('kick', 1),
      hit('kick', 2),
      hit('kick', 3),
      hit('snare', 1),
      hit('snare', 3),
      ...offbeatHats(),
    ],
  },
  {
    id: 'eight_beat',
    hits: [
      hit('kick', 0),
      hit('kick', 2),
      hit('snare', 1),
      hit('snare', 3),
      ...eighthHats(),
    ],
  },
  {
    id: 'sixteen_beat',
    hits: [
      hit('kick', 0),
      hit('kick', 2),
      hit('snare', 1),
      hit('snare', 3),
      ...sixteenthHats(),
    ],
  },
  {
    id: 'rock',
    hits: [
      hit('kick', 0),
      hit('kick', 2.5, '16n'),
      hit('snare', 1),
      hit('snare', 3),
      ...eighthHats(),
    ],
  },
  {
    id: 'half_time',
    hits: [
      hit('kick', 0, '4n'),
      hit('snare', 2, '4n'),
      hit('hat', 0, '8n'),
      hit('hat', 1, '8n'),
      hit('hat', 2, '8n'),
      hit('hat', 3, '8n'),
    ],
  },
  {
    id: 'disco',
    hits: [
      hit('kick', 0),
      hit('kick', 1),
      hit('kick', 2),
      hit('kick', 3),
      hit('snare', 1),
      hit('snare', 3),
      hit('hat', 0.5, '16n'),
      hit('hat', 1.5, '16n'),
      hit('hat', 2.5, '16n'),
      hit('hat', 3.5, '16n'),
      hit('hat', 0.75, '16n'),
      hit('hat', 2.75, '16n'),
    ],
  },
  {
    id: 'ballad',
    hits: [
      hit('kick', 0, '4n'),
      hit('snare', 1, '8n'),
      hit('snare', 3, '8n'),
      hit('hat', 0, '8n'),
      hit('hat', 2, '8n'),
    ],
  },
]

const STYLE_IDS = PATTERNS.map((p) => p.id)

function cloneHits(hits: DrumHit[]): DrumHit[] {
  return hits.map((h) => ({ ...h }))
}

function patternById(id: DrumStyleId): PatternDef {
  return PATTERNS.find((p) => p.id === id) ?? PATTERNS[0]!
}

function pickStyle(select: DrumStyleSelect): DrumStyleId {
  if (select === 'any') {
    return STYLE_IDS[Math.floor(Math.random() * STYLE_IDS.length)]!
  }
  return select
}

function hasHit(
  hits: DrumHit[],
  instrument: DrumInstrument,
  beat: number,
  eps = 0.01,
): boolean {
  return hits.some(
    (h) => h.instrument === instrument && Math.abs(h.beat - beat) < eps,
  )
}

function quantize16(beat: number): number {
  return Math.round(beat * 4) / 4
}

const EXTRA_KICK_SLOTS = [0.5, 1.5, 2.5, 3.5, 0.75, 2.75, 3.75]
const EXTRA_SNARE_SLOTS = [0.5, 1.5, 2.5, 3.5, 1.75, 2.75]
const EXTRA_HAT_SLOTS = [
  0.25, 0.75, 1.25, 1.75, 2.25, 2.75, 3.25, 3.75, 0.5, 1.5, 2.5, 3.5,
]

/**
 * Keep the groove recognizable; add/remove a few hits.
 * density 0–100 controls how many mutations (light arrange).
 */
function lightArrange(hits: DrumHit[], density: number): DrumHit[] {
  const result = cloneHits(hits)
  const intensity = Math.max(0, Math.min(1, density / 100))
  const addBudget = 1 + Math.floor(intensity * 3) // 1–4
  const dropBudget = intensity > 0.55 ? 1 : 0

  let adds = 0
  while (adds < addBudget) {
    const roll = Math.random()
    if (roll < 0.4) {
      const slot = EXTRA_HAT_SLOTS[Math.floor(Math.random() * EXTRA_HAT_SLOTS.length)]!
      if (!hasHit(result, 'hat', slot)) {
        result.push(hit('hat', slot, '16n'))
        adds++
      } else {
        adds++ // avoid infinite loop on full grid
      }
    } else if (roll < 0.75) {
      const slot =
        EXTRA_KICK_SLOTS[Math.floor(Math.random() * EXTRA_KICK_SLOTS.length)]!
      if (!hasHit(result, 'kick', slot)) {
        result.push(hit('kick', slot, '16n'))
        adds++
      } else {
        adds++
      }
    } else {
      const slot =
        EXTRA_SNARE_SLOTS[Math.floor(Math.random() * EXTRA_SNARE_SLOTS.length)]!
      if (!hasHit(result, 'snare', slot)) {
        result.push(hit('snare', slot, '16n'))
        adds++
      } else {
        adds++
      }
    }
  }

  if (dropBudget > 0) {
    // Prefer dropping non-downbeat hats so groove stays clear
    const droppable = result
      .map((h, i) => ({ h, i }))
      .filter(
        ({ h }) =>
          h.instrument === 'hat' &&
          Math.abs(h.beat % 1) > 0.01 &&
          Math.abs((h.beat % 1) - 0.5) > 0.01,
      )
    if (droppable.length > 0 && Math.random() < 0.7) {
      const pick = droppable[Math.floor(Math.random() * droppable.length)]!
      result.splice(pick.i, 1)
    }
  }

  return result
    .map((h) => ({ ...h, beat: quantize16(h.beat) }))
    .sort((a, b) => a.beat - b.beat || a.instrument.localeCompare(b.instrument))
}

function offsetBar(hits: DrumHit[], barIndex: number): DrumHit[] {
  return hits.map((h) => ({ ...h, beat: h.beat + barIndex * 4 }))
}

function resolveArrange(
  mode: DrumArrangeMode,
  candidateIndex: number,
): boolean {
  if (mode === 'clean') return false
  if (mode === 'light') return true
  // mixed: alternate-ish with randomness
  return candidateIndex % 2 === 1 || Math.random() < 0.35
}

export function generateDrumPhrase(
  barCount: number,
  bpm: number,
  density: number,
  styleSelect: DrumStyleSelect = 'any',
  arrange: boolean = true,
): DrumPhrase {
  const styleId = pickStyle(styleSelect)
  const base = patternById(styleId)
  let hits: DrumHit[] = []
  for (let b = 0; b < barCount; b++) {
    const barHits = arrange
      ? lightArrange(base.hits, density)
      : cloneHits(base.hits)
    hits = hits.concat(offsetBar(barHits, b))
  }
  hits.sort((a, b) => a.beat - b.beat)
  return {
    id: uid('drm'),
    bars: barCount,
    bpm,
    hits,
    styleId,
    label: arrange
      ? `${DRUM_STYLE_LABELS[styleId]}（アレンジ）`
      : DRUM_STYLE_LABELS[styleId],
    arranged: arrange,
  }
}

export function generateDrumCandidates(
  count: number,
  barCount: number,
  bpm: number,
  density: number,
  styleSelect: DrumStyleSelect = 'any',
  arrangeMode: DrumArrangeMode = 'mixed',
): DrumPhrase[] {
  return Array.from({ length: count }, (_, i) =>
    generateDrumPhrase(
      barCount,
      bpm,
      density,
      styleSelect,
      resolveArrange(arrangeMode, i),
    ),
  )
}

export function drumInstrumentMidi(inst: DrumInstrument): number {
  switch (inst) {
    case 'kick':
      return 36
    case 'snare':
      return 38
    case 'hat':
      return 42
  }
}

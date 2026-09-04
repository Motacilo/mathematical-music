import type { DrumHit, DrumInstrument, DrumPhrase } from '../projectTypes'
import { uid } from '../chords/theory'

type Pattern = { name: string; hits: Omit<DrumHit, never>[] }

const PATTERNS: Pattern[] = [
  {
    name: 'basic',
    hits: [
      { instrument: 'kick', beat: 0, duration: '8n' },
      { instrument: 'hat', beat: 0, duration: '8n' },
      { instrument: 'hat', beat: 1, duration: '8n' },
      { instrument: 'snare', beat: 2, duration: '8n' },
      { instrument: 'hat', beat: 2, duration: '8n' },
      { instrument: 'hat', beat: 3, duration: '8n' },
    ],
  },
  {
    name: 'four_on_floor',
    hits: [
      { instrument: 'kick', beat: 0, duration: '8n' },
      { instrument: 'kick', beat: 1, duration: '8n' },
      { instrument: 'kick', beat: 2, duration: '8n' },
      { instrument: 'kick', beat: 3, duration: '8n' },
      { instrument: 'hat', beat: 0.5, duration: '16n' },
      { instrument: 'hat', beat: 1.5, duration: '16n' },
      { instrument: 'hat', beat: 2.5, duration: '16n' },
      { instrument: 'hat', beat: 3.5, duration: '16n' },
      { instrument: 'snare', beat: 2, duration: '8n' },
    ],
  },
  {
    name: 'syncopated',
    hits: [
      { instrument: 'kick', beat: 0, duration: '8n' },
      { instrument: 'kick', beat: 1.5, duration: '8n' },
      { instrument: 'snare', beat: 2, duration: '8n' },
      { instrument: 'kick', beat: 3, duration: '16n' },
      { instrument: 'hat', beat: 0, duration: '8n' },
      { instrument: 'hat', beat: 1, duration: '8n' },
      { instrument: 'hat', beat: 2, duration: '8n' },
      { instrument: 'hat', beat: 3, duration: '8n' },
    ],
  },
  {
    name: 'sparse',
    hits: [
      { instrument: 'kick', beat: 0, duration: '4n' },
      { instrument: 'snare', beat: 2, duration: '4n' },
      { instrument: 'hat', beat: 1, duration: '8n' },
      { instrument: 'hat', beat: 3, duration: '8n' },
    ],
  },
]

function mutateHits(hits: DrumHit[], density: number): DrumHit[] {
  const result = hits.map((h) => ({ ...h }))
  // density 0–100: add hats or drop hits
  if (density > 60) {
    for (let b = 0; b < 4; b += 0.5) {
      if (Math.random() < (density - 60) / 80) {
        result.push({ instrument: 'hat', beat: b, duration: '16n' })
      }
    }
  }
  if (density < 40) {
    return result.filter((h) => {
      if (h.instrument === 'hat' && Math.random() < (40 - density) / 50) {
        return false
      }
      return true
    })
  }
  return result
}

function offsetBar(hits: DrumHit[], barIndex: number): DrumHit[] {
  return hits.map((h) => ({ ...h, beat: h.beat + barIndex * 4 }))
}

export function generateDrumPhrase(
  barCount: number,
  bpm: number,
  density: number,
): DrumPhrase {
  const base = PATTERNS[Math.floor(Math.random() * PATTERNS.length)]!
  let hits: DrumHit[] = []
  for (let b = 0; b < barCount; b++) {
    const mutated = mutateHits(
      base.hits.map((h) => ({ ...h })),
      density,
    )
    hits = hits.concat(offsetBar(mutated, b))
  }
  // light random kick extra
  if (Math.random() < density / 150) {
    hits.push({
      instrument: 'kick',
      beat: 3.5 + Math.floor(Math.random() * barCount) * 4,
      duration: '16n',
    })
  }
  hits.sort((a, b) => a.beat - b.beat)
  return {
    id: uid('drm'),
    bars: barCount,
    bpm,
    hits,
  }
}

export function generateDrumCandidates(
  count: number,
  barCount: number,
  bpm: number,
  density: number,
): DrumPhrase[] {
  return Array.from({ length: count }, () =>
    generateDrumPhrase(barCount, bpm, density),
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

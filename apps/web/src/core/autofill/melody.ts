/**
 * Melody writer for the automatic (おまかせ) generators.
 *
 * Earlier versions drew every bar from the same few fixed rhythms (mostly
 * straight eighths) and picked each pitch independently, so every song in a
 * mood sounded alike. This writer adds three kinds of character:
 *
 * - Rhythm: each section picks two motif rhythms plus a cadence rhythm from a
 *   library of one-bar patterns and lays them out per four-bar phrase
 *   (A B A C, A A B C, ...). How busy the patterns are depends on the section
 *   role, the mood and the song.
 * - Shape: each four-bar phrase follows a contour (arch, rise, fall, ...)
 *   around a register and span chosen per song.
 * - Motion: pitches are chosen relative to the previous note, so lines move
 *   mostly by step with occasional leaps; how leapy depends on the song.
 *
 * Harmony: exposed notes (see isExposedNote) are chord tones; other notes may
 * be passing tones but never a semitone away from a chord tone.
 */
import { uid } from '../chords/theory'
import { isPitchInScale } from '../distributionWeights'
import { chordPitchClasses, isExposedNote, rubsAgainst } from '../harmony/fitMelody'
import type { ChordBar } from '../projectTypes'
import { DURATION_BEATS } from '../rhythm'
import type { Duration, Note, Phrase, ScaleType } from '../types'

export type SongFeel = {
  /** Added to the section's rhythm density (-1 sparse … +1 busy). */
  density: number
  /** Semitones added to the melody register. */
  register: number
  /** Half-width of the melodic range in semitones. */
  span: number
  /** Typical interval size in semitones; small = stepwise, large = leapy. */
  leap: number
  /**
   * The rhythm patterns this song draws from: about half of each density
   * group, so two songs in the same mood lean on different rhythms.
   */
  rhythmPalette: readonly string[]
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

function rand(lo: number, hi: number): number {
  return lo + Math.random() * (hi - lo)
}

function sample<T>(arr: readonly T[], n: number): T[] {
  const copy = arr.slice()
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy.slice(0, n)
}

export function randomSongFeel(): SongFeel {
  const half = (list: readonly string[]) => sample(list, Math.max(3, Math.ceil(list.length / 2)))
  return {
    density: rand(-0.6, 0.6),
    register: pick([-3, -1, 0, 0, 2, 4]),
    span: pick([5, 7, 7, 9]),
    leap: pick([1.8, 2.5, 3.2, 4.5]),
    rhythmPalette: [
      ...half(RHYTHM_LIBRARY.sparse),
      ...half(RHYTHM_LIBRARY.medium),
      ...half(RHYTHM_LIBRARY.busy),
    ],
  }
}

/** One-bar rhythm patterns. 'r' marks a rest. Each sums to four beats. */
export const RHYTHM_LIBRARY = {
  sparse: [
    '2n 2n',
    '4n 4n 2n',
    '2n 4n 4n',
    '4n. 8n 2n',
    '2n 4n. 8n',
    '4n r4n 2n',
    'r4n 4n 2n',
    '4n. 8n 4n r4n',
    '1n',
    '2n 8n 8n 4n',
    'r8n 4n 8n 2n',
    '4n. 4n. 4n',
  ],
  medium: [
    '4n 4n 4n 4n',
    '4n. 8n 4n 4n',
    '4n 8n 8n 4n 4n',
    '8n 8n 4n 4n 4n',
    '4n 4n 4n. 8n',
    '4n. 8n 4n. 8n',
    'r8n 8n 4n 4n 4n',
    '4n 8n 8n 2n',
    '8n 4n 8n 4n 4n',
    '4n 4n 8n 8n 4n',
    '4n. 8n 2n',
    'r4n 8n 8n 4n 4n',
    '4n 4n. 8n 4n',
    '8n 4n. 4n 4n',
    '8n 4n 4n 4n 8n',
    '4n 8n 4n 8n 4n',
    '4n. 4n. 8n 8n',
  ],
  busy: [
    '8n 8n 8n 8n 8n 8n 8n 8n',
    '8n 8n 4n 8n 8n 4n',
    '16n 16n 8n 8n 8n 4n 4n',
    '8n 4n 8n 8n 4n 8n',
    '8n. 16n 8n 8n 8n. 16n 8n 8n',
    '4n 8n 8n 8n 8n 4n',
    'r8n 8n 8n 8n 4n 8n 8n',
    '8n 8n 8n 8n 4n 4n',
    '8n 4n 4n 8n 4n',
    '16n 16n 16n 16n 8n 8n 4n 4n',
    '8n 8n r8n 8n 4n 4n',
    '8n 8n 8n 4n 8n 4n',
    '16n 8n 16n 8n 8n 4n 4n',
    '8n. 16n 4n 8n. 16n 4n',
    '4n. 8n 8n 8n 8n 8n',
    '8n 16n 16n 8n 8n 4n 4n',
  ],
} as const

/** Phrase endings: settle on a longer note. */
export const CADENCE_RHYTHMS = [
  '2n 2n',
  '4n 4n 2n',
  '4n. 8n 2n',
  '1n',
  '4n 8n 8n 2n',
  '8n 8n 4n 2n',
] as const

type Slot = { duration: Duration; rest: boolean }

export function parseRhythm(text: string): Slot[] {
  return text.split(' ').map((tok) => {
    const rest = tok.startsWith('r')
    return { duration: (rest ? tok.slice(1) : tok) as Duration, rest }
  })
}

function pickRhythm(level: number, palette: readonly string[]): string {
  const l = Math.max(-1.5, Math.min(1.5, level))
  const own = (list: readonly string[]) => {
    const mine = list.filter((r) => palette.includes(r))
    return mine.length > 0 ? mine : list
  }
  const groups = [
    { list: own(RHYTHM_LIBRARY.sparse), w: Math.exp(-((l + 1) ** 2)) },
    { list: own(RHYTHM_LIBRARY.medium), w: Math.exp(-(l ** 2)) },
    { list: own(RHYTHM_LIBRARY.busy), w: Math.exp(-((l - 1) ** 2)) },
  ]
  const total = groups.reduce((s, g) => s + g.w, 0)
  let r = Math.random() * total
  for (const g of groups) {
    r -= g.w
    if (r <= 0) return pick(g.list)
  }
  return pick(RHYTHM_LIBRARY.medium)
}

const PHRASE_LAYOUTS = [
  ['A', 'B', 'A', 'C'],
  ['A', 'A', 'B', 'C'],
  ['A', 'B', 'A', 'B'],
  ['A', 'B', 'B', 'C'],
  ['A', 'A', 'A', 'C'],
] as const

/** Rhythm text for every bar of a section. */
function planRhythms(bars: number, level: number, palette: readonly string[]): string[] {
  const a = pickRhythm(level, palette)
  let b = pickRhythm(level, palette)
  for (let i = 0; i < 4 && b === a; i++) b = pickRhythm(level, palette)
  const c = pick(CADENCE_RHYTHMS)
  const out: string[] = []
  for (let start = 0; start < bars; start += 4) {
    const layout = pick(PHRASE_LAYOUTS)
    for (let j = 0; j < 4 && start + j < bars; j++) {
      const isLastBar = start + j === bars - 1
      const role = isLastBar ? 'C' : layout[j]!
      out.push(role === 'A' ? a : role === 'B' ? b : c)
    }
  }
  return out
}

const CONTOURS: readonly (readonly number[])[] = [
  [0, 2, 3, 0], // arch
  [-2, 0, 2, 3], // rise
  [3, 1, 0, -2], // fall
  [1, -1, -2, 0], // valley
  [0, 2, 0, 2], // wave
]

export type MelodyOptions = {
  bars: number
  keyRoot: number
  scale: ScaleType
  bpm: number
  chords: ChordBar[]
  feel: SongFeel
  /** Section / mood density before the song's own lean. */
  density: number
  /** Semitones added to the register for this section (e.g. higher chorus). */
  centerShift: number
  /** 0–100: extra chance a weak note becomes a rest. */
  restPercent: number
}

function weightedPick(cands: number[], weights: number[]): number {
  const total = weights.reduce((s, w) => s + w, 0)
  if (total <= 0) return pick(cands)
  let r = Math.random() * total
  for (let i = 0; i < cands.length; i++) {
    r -= weights[i]!
    if (r <= 0) return cands[i]!
  }
  return cands[cands.length - 1]!
}

export function writeMelody(opts: MelodyOptions): Phrase[] {
  const { bars, keyRoot, scale, bpm, chords, feel } = opts
  const level = opts.density + feel.density
  const rhythms = planRhythms(bars, level, feel.rhythmPalette)

  let base = 60 + (((keyRoot % 12) + 12) % 12)
  if (base > 67) base -= 12
  // Keep the register singable: roughly G3 to D5 for the center.
  const center = Math.max(55, Math.min(74, base + opts.centerShift + feel.register))
  const lo = center - feel.span - 3
  const hi = center + feel.span + 3
  const scaleUnit = feel.span / 7

  const out: Phrase[] = []
  let prev: number | undefined
  let prev2: number | undefined
  let repeats = 0
  let contour = pick(CONTOURS)

  for (let bar = 0; bar < bars; bar++) {
    if (bar % 4 === 0) contour = pick(CONTOURS)
    const target = center + contour[bar % 4]! * scaleUnit
    const chord = chords[bar]
    const pcs = chord ? chordPitchClasses(chord) : []
    const slots = parseRhythm(rhythms[bar]!)
    const notes: Note[] = []
    let beat = 0
    let soundedInBar = 0

    for (const slot of slots) {
      const onset = beat
      const length = DURATION_BEATS[slot.duration]
      beat += length
      const exposed = isExposedNote(onset, length)
      const extraRest =
        !exposed && soundedInBar > 0 && Math.random() * 100 < opts.restPercent
      if (slot.rest || extraRest) {
        notes.push({ pitch: 0, duration: slot.duration, rest: true })
        continue
      }

      const cands: number[] = []
      const weights: number[] = []
      for (let p = lo; p <= hi; p++) {
        const pc = ((p % 12) + 12) % 12
        const chordTone = pcs.length === 0 || pcs.includes(pc)
        if (!isPitchInScale(p, keyRoot, scale) && !chordTone) continue
        if (exposed && !chordTone) continue
        if (!chordTone && rubsAgainst(pc, pcs)) continue
        let w = Math.exp(-0.5 * ((p - target) / (feel.span * 0.75)) ** 2)
        if (prev != null) {
          w *= Math.exp(-0.5 * ((p - prev) / feel.leap) ** 2)
          if (p === prev) w *= repeats >= 1 ? 0.12 : 0.45
          // After a leap, lean toward a step back the other way (gap fill).
          if (prev2 != null && Math.abs(prev - prev2) > 4) {
            const back = Math.sign(prev2 - prev)
            const step = p - prev
            if (Math.sign(step) === back && Math.abs(step) <= 2) w *= 2.2
          }
        }
        if (chordTone && !exposed) w *= 1.5
        cands.push(p)
        weights.push(w)
      }
      const pitch = cands.length > 0 ? weightedPick(cands, weights) : (prev ?? center)
      repeats = pitch === prev ? repeats + 1 : 0
      prev2 = prev
      prev = pitch
      soundedInBar++
      notes.push({ pitch, duration: slot.duration })
    }

    out.push({ id: uid('mel'), notes, bars: 1, bpm, keyRoot, scale })
  }
  return out
}

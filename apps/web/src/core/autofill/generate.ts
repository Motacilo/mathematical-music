import { generateBassFollowChords } from '../bass/generate'
import { generateMarkovProgression } from '../chords/generate'
import { uid } from '../chords/theory'
import { createDefaultRootEnable } from '../chords/roots'
import {
  generateDrumPhrase,
  type DrumStyleId,
} from '../drums/generate'
import { fitMelodyToChords } from '../harmony/fitMelody'
import { randomSongFeel, writeMelody, type SongFeel } from './melody'
import { splitPhraseIntoBars } from '../phraseSplit'
import {
  createDefaultQualityEnable,
  type ChordBar,
  type DrumPhrase,
} from '../projectTypes'
import { BAR_BEATS } from '../rhythm'
import type { Note, Phrase, RhythmId, ScaleType } from '../types'

/** Soft cap for each layer's stage length (bars). */
export const MAX_STAGE_BARS = 256

export const AUTOFILL_BAR_OPTIONS = [
  4, 8, 12, 16, 24, 32, 48, 64, 96, 128,
] as const

export type AutofillOptions = {
  /** If set, the drum groove is chosen from this list */
  drumStyles?: readonly DrumStyleId[]
  /** If set, every drum block uses this instead of the random arrange roll */
  arrangeDrums?: boolean
  /** Melody rhythm density: -1 sparse … 0 medium … +1 busy */
  melodyDensity?: number
  /** Song-wide melodic character; random when omitted */
  feel?: SongFeel
  /**
   * Repeat inside each 8-bar block: 4+4 (40%), 2+2+4, 4+2+2, or none (20% each).
   * The block's final chord keeps its cadence, so a repeated half can end differently.
   */
  repeatPhrases?: boolean
  restChoices?: readonly number[]
  bassRhythms?: readonly RhythmId[]
  /** Semitones added to the melody register */
  centerShift?: number
  /** Diatonic degree 1–7 for the first chord */
  chordStart?: number
  /** Diatonic degree 1–7 forced onto the last chord */
  chordEnd?: number
  /** Repeat each chord for two bars (slower harmony) */
  holdPairs?: boolean
  skipCadence?: boolean
  drumDensity?: number
  /** Lowest bar count accepted by this call. Default 4. */
  minBars?: number
}

export type AutofillResult = {
  bars: number
  melody: Phrase[]
  chords: ChordBar[]
  bass: Phrase[]
  drums: DrumPhrase[]
  drumStyleId: DrumStyleId
  styleSummary: string
  /** Repeat layout used for 8-bar blocks, e.g. "4+4" */
  repeatPlan: string
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

function clampBars(n: number, min = 4): number {
  return Math.min(128, Math.max(min, Math.round(n)))
}

function emptyBarPhrase(proto: {
  bpm: number
  keyRoot: number
  scale: ScaleType
}): Phrase {
  const notes: Note[] = Array.from({ length: BAR_BEATS }, () => ({
    pitch: 36,
    duration: '4n' as const,
    rest: true,
  }))
  return {
    id: uid('bar'),
    notes,
    bars: 1,
    bpm: proto.bpm,
    keyRoot: proto.keyRoot,
    scale: proto.scale,
  }
}

/** Force exactly `barCount` one-bar phrases (pad rests / trim). */
function fitOneBarPhrases(
  parts: Phrase[],
  barCount: number,
  proto: { bpm: number; keyRoot: number; scale: ScaleType },
): Phrase[] {
  const out: Phrase[] = parts.slice(0, barCount).map((p) => ({
    ...p,
    bars: 1,
    id: p.id || uid('bar'),
  }))
  while (out.length < barCount) {
    out.push(emptyBarPhrase(proto))
  }
  return out
}

/** Prefer cadences every ~8 bars for long progressions. */
function chordOfDegree(
  degree: number,
  keyRoot: number,
  scale: ScaleType,
  bpm: number,
  qualityEnable: ReturnType<typeof createDefaultQualityEnable>,
  rootEnable: ReturnType<typeof createDefaultRootEnable>,
): ChordBar | undefined {
  return generateMarkovProgression(
    1,
    keyRoot,
    scale,
    bpm,
    qualityEnable,
    rootEnable,
    degree,
  )[0]
}

function generateAutofillChords(
  barCount: number,
  keyRoot: number,
  scale: ScaleType,
  bpm: number,
  options?: AutofillOptions,
): ChordBar[] {
  const qualityEnable = createDefaultQualityEnable()
  const rootEnable = createDefaultRootEnable(scale)
  const unitCount = options?.holdPairs ? Math.ceil(barCount / 2) : barCount
  const CHUNK = 8
  const out: ChordBar[] = []
  while (out.length < unitCount) {
    const n = Math.min(CHUNK, unitCount - out.length)
    const start =
      out.length === 0
        ? (options?.chordStart ?? 1)
        : pick([1, 1, 4, 5] as const)
    const chunk = generateMarkovProgression(
      n,
      keyRoot,
      scale,
      bpm,
      qualityEnable,
      rootEnable,
      start,
    )
    if (!options?.skipCadence && n >= 4 && Math.random() < 0.75) {
      const cadDegree = pick([1, 5] as const)
      const cad = chordOfDegree(
        cadDegree,
        keyRoot,
        scale,
        bpm,
        qualityEnable,
        rootEnable,
      )
      if (cad) chunk[n - 1] = cad
    }
    out.push(...chunk)
  }
  let chords = out.slice(0, unitCount)
  if (options?.holdPairs) {
    const doubled: ChordBar[] = []
    for (const bar of chords) {
      doubled.push(bar, { ...bar, id: uid('ch') })
      if (doubled.length >= barCount) break
    }
    chords = doubled.slice(0, barCount)
  }
  if (options?.chordEnd != null && chords.length > 0) {
    const end = chordOfDegree(
      options.chordEnd,
      keyRoot,
      scale,
      bpm,
      qualityEnable,
      rootEnable,
    )
    if (end) chords[chords.length - 1] = end
  }
  return chords
}

type RepeatPlan = { name: string; weight: number; map: readonly number[] }

/** Source bar for each bar of an 8-bar block. */
export const REPEAT_PLANS: readonly RepeatPlan[] = [
  { name: '4+4', weight: 0.4, map: [0, 1, 2, 3, 0, 1, 2, 3] },
  { name: '2+2+4', weight: 0.2, map: [0, 1, 0, 1, 4, 5, 6, 7] },
  { name: '4+2+2', weight: 0.2, map: [0, 1, 2, 3, 4, 5, 4, 5] },
  { name: '8', weight: 0.2, map: [0, 1, 2, 3, 4, 5, 6, 7] },
]

function pickRepeatPlan(): RepeatPlan {
  let r = Math.random()
  for (const plan of REPEAT_PLANS) {
    r -= plan.weight
    if (r < 0) return plan
  }
  return REPEAT_PLANS[REPEAT_PLANS.length - 1]!
}

/** bar index -> source bar index, per 8-bar block. Other lengths are not repeated. */
function buildRepeatMap(bars: number, enabled: boolean): { map: number[]; names: string[] } {
  const map = Array.from({ length: bars }, (_, i) => i)
  const names: string[] = []
  if (!enabled || bars % 8 !== 0) return { map, names }
  for (let off = 0; off < bars; off += 8) {
    const plan = pickRepeatPlan()
    names.push(plan.name)
    plan.map.forEach((src, j) => {
      map[off + j] = off + src
    })
  }
  return { map, names }
}

function pickDrumStyle(bpm: number): DrumStyleId {
  if (bpm < 90) return pick(['ballad', 'half_time', 'eight_beat'])
  if (bpm < 115) return pick(['eight_beat', 'eight_beat', 'rock', 'four_on_floor'])
  if (bpm < 140) {
    return pick([
      'eight_beat',
      'four_on_floor',
      'sixteen_beat',
      'rock',
      'disco',
    ])
  }
  return pick(['sixteen_beat', 'four_on_floor', 'disco', 'eight_beat'])
}

function generateAutofillDrums(
  barCount: number,
  bpm: number,
  options?: AutofillOptions,
): { phrases: DrumPhrase[]; styleId: DrumStyleId } {
  const styleId = options?.drumStyles?.length
    ? pick(options.drumStyles)
    : pickDrumStyle(bpm)
  const BLOCK = 4
  const phrases: DrumPhrase[] = []
  let covered = 0
  while (covered < barCount) {
    const n = Math.min(BLOCK, barCount - covered)
    const arrange =
      options?.arrangeDrums != null
        ? options.arrangeDrums
        : Math.random() < 0.35
    const density = options?.drumDensity ?? (arrange ? 35 : 20)
    phrases.push(generateDrumPhrase(n, bpm, density, styleId, arrange))
    covered += n
  }
  // Safety: trim/pad total bars
  let total = phrases.reduce((s, p) => s + p.bars, 0)
  if (total > barCount) {
    // shrink last phrase
    const last = phrases[phrases.length - 1]!
    const overflow = total - barCount
    last.bars = Math.max(1, last.bars - overflow)
    last.hits = last.hits.filter((h) => h.beat < last.bars * 4)
  }
  total = phrases.reduce((s, p) => s + p.bars, 0)
  while (total < barCount) {
    const n = Math.min(BLOCK, barCount - total)
    phrases.push(generateDrumPhrase(n, bpm, 20, styleId, false))
    total += n
  }
  return { phrases, styleId }
}

/** Always follow chords (code追従). */
function generateAutofillBass(
  chords: ChordBar[],
  barCount: number,
  options?: AutofillOptions,
): Phrase[] {
  const rhythmId: RhythmId = options?.bassRhythms?.length
    ? pick(options.bassRhythms)
    : pick(['quarters', 'eighths', 'eighths'])
  const phrase = generateBassFollowChords(chords, rhythmId, 3, barCount)
  const proto = {
    bpm: chords[0]?.bpm ?? 120,
    keyRoot: chords[0]?.keyRoot ?? 0,
    scale: chords[0]?.scale ?? ('major' as ScaleType),
  }
  if (!phrase) {
    return fitOneBarPhrases([], barCount, proto)
  }
  const split = splitPhraseIntoBars(phrase).map((b) => ({
    ...b,
    id: uid('bass'),
    bars: 1,
  }))
  return fitOneBarPhrases(split, barCount, proto)
}

/**
 * Build a complete multi-layer block of `barCount` bars (4–128).
 * All layers are forced to the same bar count.
 */
export function generateAutofillSong(
  barCount: number,
  keyRoot: number,
  scale: ScaleType,
  bpm: number,
  options?: AutofillOptions,
): AutofillResult {
  const bars = clampBars(barCount, options?.minBars ?? 4)
  const { map, names } = buildRepeatMap(bars, options?.repeatPhrases ?? false)
  const rawChords = generateAutofillChords(bars, keyRoot, scale, bpm, options)
  // Repeated bars borrow the source bar's chord, except the last bar of each
  // 8-bar block, which keeps its own (cadence) chord.
  const chords = rawChords.map((chord, i) => {
    const lastOfBlock = map.length % 8 === 0 && i % 8 === 7
    return map[i] === i || lastOfBlock ? chord : { ...rawChords[map[i]!]!, id: uid('ch') }
  })
  const written = writeMelody({
    bars,
    keyRoot,
    scale,
    bpm,
    chords,
    feel: options?.feel ?? randomSongFeel(),
    density: options?.melodyDensity ?? 0,
    centerShift: options?.centerShift ?? 0,
    restPercent: pick(options?.restChoices?.length ? options.restChoices : [0, 5]) * 0.5,
  })
  const repeated = written.map((bar, i) =>
    map[i] === i
      ? bar
      : { ...written[map[i]!]!, id: uid('mel'), notes: written[map[i]!]!.notes.map((n) => ({ ...n })) },
  )
  // Safety net: keep every bar consistent with its chord (repeated bars may
  // now sit on a different chord at the end of a block).
  const melody = fitMelodyToChords(repeated, chords, keyRoot, scale)
  const bass = generateAutofillBass(chords, bars, options)
  const { phrases: drums, styleId } = generateAutofillDrums(bars, bpm, options)

  const drumLabel =
    {
      four_on_floor: '4つ打ち',
      eight_beat: 'エイトビート',
      sixteen_beat: '16ビート',
      rock: 'ロック',
      half_time: 'ハーフタイム',
      disco: 'ディスコ',
      ballad: 'バラード',
    }[styleId] ?? styleId

  return {
    bars,
    melody,
    chords,
    bass,
    drums,
    drumStyleId: styleId,
    styleSummary: `コード遷移確率 · ベース追従 · リズム ${drumLabel}`,
    repeatPlan: names.join(',') || 'none',
  }
}

/** One diatonic chord by degree (1 = tonic, 5 = dominant), with default chord settings. */
export function buildDegreeChord(
  degree: number,
  keyRoot: number,
  scale: ScaleType,
  bpm: number,
): ChordBar | undefined {
  return chordOfDegree(
    degree,
    keyRoot,
    scale,
    bpm,
    createDefaultQualityEnable(),
    createDefaultRootEnable(scale),
  )
}

export function remainingStageCapacity(currentBars: number): number {
  return Math.max(0, MAX_STAGE_BARS - Math.max(0, currentBars))
}

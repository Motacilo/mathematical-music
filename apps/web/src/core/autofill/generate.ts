import { generateBassFollowChords } from '../bass/generate'
import { generateMarkovProgression } from '../chords/generate'
import { uid } from '../chords/theory'
import { createDefaultRootEnable } from '../chords/roots'
import {
  generateDrumPhrase,
  type DrumStyleId,
} from '../drums/generate'
import { generateDistributionPhrase } from '../generators/distribution'
import { fitMelodyToChords } from '../harmony/fitMelody'
import { splitPhraseIntoBars } from '../phraseSplit'
import {
  createDefaultQualityEnable,
  type ChordBar,
  type DrumPhrase,
} from '../projectTypes'
import { BAR_BEATS, DURATION_BEATS } from '../rhythm'
import {
  createDefaultDistribution,
  type Note,
  type Phrase,
  type ProjectSettings,
  type RhythmId,
  type ScaleType,
} from '../types'

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
  melodyRhythms?: readonly RhythmId[]
  restChoices?: readonly number[]
  bassRhythms?: readonly RhythmId[]
  /** Added to the melody center before the small random drift */
  centerShift?: number
  centerJitter?: readonly number[]
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

function phraseBeatCount(phrase: Phrase): number {
  return phrase.notes.reduce(
    (s, n) => s + (DURATION_BEATS[n.duration] ?? 0),
    0,
  )
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

/** Fixed rhythms only — one bar at a time so counts never drift. */
const MELODY_RHYTHMS: RhythmId[] = ['quarters', 'eighths', 'eighths', 'eighths']

function generateAutofillMelody(
  barCount: number,
  keyRoot: number,
  scale: ScaleType,
  bpm: number,
  options?: AutofillOptions,
): Phrase[] {
  const octave = 4
  const distribution = createDefaultDistribution(keyRoot, octave, scale)
  const rhythms = options?.melodyRhythms?.length
    ? options.melodyRhythms
    : MELODY_RHYTHMS
  const rests = options?.restChoices?.length
    ? options.restChoices
    : [0, 0, 5, 10]
  const bars: Phrase[] = []

  for (let i = 0; i < barCount; i++) {
    const settings: ProjectSettings = {
      keyRoot,
      scale,
      bpm,
      octave,
      rhythmId: pick(rhythms),
      candidateCount: 1,
      barCount: 1,
      restProbability: pick(rests),
    }
    const jitter = options?.centerJitter?.length
      ? options.centerJitter
      : [-2, -1, 0, 0, 1, 2]
    const drifted = {
      ...distribution,
      centerMidi:
        distribution.centerMidi + (options?.centerShift ?? 0) + pick(jitter),
    }
    const phrase = generateDistributionPhrase(settings, drifted)
    const split = splitPhraseIntoBars(phrase)
    const one =
      split.find((p) => Math.abs(phraseBeatCount(p) - BAR_BEATS) < 0.2) ??
      split[0]
    bars.push(
      one
        ? { ...one, id: uid('mel'), bars: 1 }
        : emptyBarPhrase({ bpm, keyRoot, scale }),
    )
  }
  return fitOneBarPhrases(bars, barCount, { bpm, keyRoot, scale })
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
  const chords = generateAutofillChords(bars, keyRoot, scale, bpm, options)
  // Melody is drawn from the key, then bent onto each bar's chord so the
  // automatic result does not clash with the harmony underneath.
  const melody = fitMelodyToChords(
    generateAutofillMelody(bars, keyRoot, scale, bpm, options),
    chords,
    keyRoot,
    scale,
  )
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
  }
}

export function remainingStageCapacity(currentBars: number): number {
  return Math.max(0, MAX_STAGE_BARS - Math.max(0, currentBars))
}

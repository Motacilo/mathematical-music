import {
  approxDegreeFromOffset,
  resolveRootId,
  uid,
} from '../chords/theory'
import { rootDef, rootIdFromOffset, type ChordRootId } from '../chords/roots'
import type { ChordBar, ChordQuality } from '../projectTypes'
import { getScaleIntervals, snapToScale } from '../scale'
import { transposePhrase } from '../transpose'
import type { Note, Phrase, ScaleType } from '../types'

export interface PhraseArrangeVariant {
  id: string
  label: string
  phrase: Phrase
}

export interface ChordArrangeVariant {
  id: string
  label: string
  progression: ChordBar[]
}

const HEIGHT_DELTAS = [-3, -2, -1, 1, 2, 3] as const

const QUALITY_NEAR: Partial<Record<ChordQuality, ChordQuality[]>> = {
  maj: ['maj7', 'maj6', 'sus4', 'sus2'],
  min: ['min7', 'min6', 'sus2'],
  maj7: ['maj', 'maj6'],
  min7: ['min', 'min6'],
  dom7: ['maj', 'sus4'],
  maj6: ['maj', 'maj7'],
  min6: ['min', 'min7'],
  sus2: ['maj', 'sus4'],
  sus4: ['maj', 'sus2'],
  dim: ['m7b5', 'dim7'],
  aug: ['maj'],
  dim7: ['dim', 'm7b5'],
  m7b5: ['dim', 'min7'],
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

function cloneNotes(notes: Note[]): Note[] {
  return notes.map((n) => ({ ...n }))
}

function withNewPhraseId(phrase: Phrase, notes: Note[]): Phrase {
  return {
    ...phrase,
    id: uid('ph'),
    notes: cloneNotes(notes),
  }
}

function isScaleTone(midi: number, keyRoot: number, scale: ScaleType): boolean {
  const intervals = getScaleIntervals(scale)
  const rel = (((midi % 12) + 12) % 12 - ((keyRoot % 12) + 12) % 12 + 12) % 12
  return intervals.includes(rel)
}

/** Move pitch by ±scale steps (keeps in key). */
function nudgeInScale(
  midi: number,
  keyRoot: number,
  scale: ScaleType,
  steps: number,
): number {
  if (steps === 0) return midi
  const dir = steps > 0 ? 1 : -1
  let left = Math.abs(steps)
  let pitch = midi
  let guard = 0
  while (left > 0 && guard < 48) {
    pitch += dir
    guard++
    if (isScaleTone(pitch, keyRoot, scale)) left--
  }
  return Math.max(0, Math.min(127, pitch))
}

function soundingIndices(notes: Note[]): number[] {
  const out: number[] = []
  notes.forEach((n, i) => {
    if (!n.rest) out.push(i)
  })
  return out
}

function variantTranspose(phrase: Phrase, semitones: number): PhraseArrangeVariant {
  const sign = semitones > 0 ? '+' : ''
  const newKey = (((phrase.keyRoot + semitones) % 12) + 12) % 12
  const transposed = transposePhrase(phrase, semitones, newKey)
  return {
    id: uid('arr'),
    label: `高さ ${sign}${semitones}`,
    phrase: { ...transposed, id: uid('ph') },
  }
}

function variantTweakNotes(phrase: Phrase): PhraseArrangeVariant | null {
  const notes = cloneNotes(phrase.notes)
  const idxs = soundingIndices(notes)
  if (idxs.length === 0) return null
  const changeCount = Math.min(
    idxs.length,
    Math.max(1, Math.round(idxs.length * 0.28)),
    3,
  )
  const targets = shuffle(idxs).slice(0, changeCount)
  for (const i of targets) {
    const n = notes[i]!
    const steps = pick([-2, -1, 1, 2])
    let next = nudgeInScale(n.pitch, phrase.keyRoot, phrase.scale, steps)
    if (next === n.pitch) {
      next = snapToScale(n.pitch + steps, phrase.keyRoot, phrase.scale)
    }
    notes[i] = { ...n, pitch: next }
  }
  return {
    id: uid('arr'),
    label: `数音変更（${changeCount}音）`,
    phrase: withNewPhraseId(phrase, notes),
  }
}

function variantTweakAndShift(phrase: Phrase, semitones: number): PhraseArrangeVariant | null {
  const base = variantTranspose(phrase, semitones)
  const tweaked = variantTweakNotes(base.phrase)
  if (!tweaked) return base
  const sign = semitones > 0 ? '+' : ''
  return {
    id: uid('arr'),
    label: `高さ ${sign}${semitones}＋数音`,
    phrase: tweaked.phrase,
  }
}

/** Random arrange variants for a melody/bass phrase. */
export function generatePhraseArrangeVariants(
  source: Phrase,
  count = 5,
): PhraseArrangeVariant[] {
  const variants: PhraseArrangeVariant[] = []
  const used = new Set<string>()

  const push = (v: PhraseArrangeVariant | null) => {
    if (!v || variants.length >= count) return
    if (used.has(v.label)) return
    used.add(v.label)
    variants.push(v)
  }

  // Prefer a mix: height shifts + note tweaks
  for (const d of shuffle([...HEIGHT_DELTAS])) {
    push(variantTranspose(source, d))
    if (variants.length >= Math.ceil(count * 0.55)) break
  }
  push(variantTweakNotes(source))
  push(variantTweakNotes(source))
  for (const d of shuffle([...HEIGHT_DELTAS]).slice(0, 3)) {
    push(variantTweakAndShift(source, d))
  }
  // Fill remaining with more tweaks / leftover heights
  let guard = 0
  while (variants.length < count && guard < 12) {
    guard++
    if (Math.random() < 0.5) push(variantTweakNotes(source))
    else push(variantTranspose(source, pick(HEIGHT_DELTAS)))
  }
  return variants.slice(0, count)
}

function cloneProg(prog: ChordBar[]): ChordBar[] {
  return prog.map((c) => ({
    ...c,
    id: uid('ch'),
  }))
}

function variantChordHeight(
  prog: ChordBar[],
  semitones: number,
): ChordArrangeVariant {
  const sign = semitones > 0 ? '+' : ''
  return {
    id: uid('arr'),
    label: `高さ ${sign}${semitones}`,
    progression: prog.map((c) => {
      const keyRoot = (((c.keyRoot + semitones) % 12) + 12) % 12
      return { ...c, id: uid('ch'), keyRoot }
    }),
  }
}

function diatonicRoots(scale: ScaleType): ChordRootId[] {
  return scale === 'major'
    ? ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']
    : ['I', 'II', 'bIII', 'IV', 'V', 'bVI', 'bVII']
}

function neighborRoot(id: ChordRootId, scale: ScaleType): ChordRootId {
  const list = diatonicRoots(scale)
  const idx = list.indexOf(id)
  if (idx < 0) {
    const offset = rootDef(id).offset
    const shifted = rootIdFromOffset(offset + pick([-2, 2]))
    return shifted
  }
  const delta = pick([-1, 1])
  return list[(idx + delta + list.length) % list.length]!
}

function nearQuality(q: ChordQuality): ChordQuality {
  const near = QUALITY_NEAR[q]
  if (!near || near.length === 0) return q
  return pick(near)
}

function variantChordTweak(prog: ChordBar[]): ChordArrangeVariant | null {
  if (prog.length === 0) return null
  const out = cloneProg(prog)
  const changeCount = Math.min(out.length, Math.max(1, Math.round(out.length * 0.4)))
  const idxs = shuffle(out.map((_, i) => i)).slice(0, changeCount)
  for (const i of idxs) {
    const bar = out[i]!
    if (Math.random() < 0.55) {
      const rootId = neighborRoot(resolveRootId(bar), bar.scale)
      const offset = rootDef(rootId).offset
      out[i] = {
        ...bar,
        rootId,
        rootOffset: offset,
        degree: approxDegreeFromOffset(offset, bar.scale),
      }
    } else {
      out[i] = { ...bar, quality: nearQuality(bar.quality) }
    }
  }
  return {
    id: uid('arr'),
    label: `数コード変更（${changeCount}）`,
    progression: out,
  }
}

function variantChordBoth(
  prog: ChordBar[],
  semitones: number,
): ChordArrangeVariant | null {
  const height = variantChordHeight(prog, semitones)
  const tweaked = variantChordTweak(height.progression)
  if (!tweaked) return height
  const sign = semitones > 0 ? '+' : ''
  return {
    id: uid('arr'),
    label: `高さ ${sign}${semitones}＋変更`,
    progression: tweaked.progression,
  }
}

/** Random arrange variants for a chord progression. */
export function generateChordArrangeVariants(
  source: ChordBar[],
  count = 5,
): ChordArrangeVariant[] {
  const variants: ChordArrangeVariant[] = []
  const used = new Set<string>()

  const push = (v: ChordArrangeVariant | null) => {
    if (!v || variants.length >= count) return
    if (used.has(v.label)) return
    used.add(v.label)
    variants.push(v)
  }

  for (const d of shuffle([...HEIGHT_DELTAS])) {
    push(variantChordHeight(source, d))
    if (variants.length >= Math.ceil(count * 0.55)) break
  }
  push(variantChordTweak(source))
  push(variantChordTweak(source))
  for (const d of shuffle([...HEIGHT_DELTAS]).slice(0, 2)) {
    push(variantChordBoth(source, d))
  }
  let guard = 0
  while (variants.length < count && guard < 12) {
    guard++
    if (Math.random() < 0.5) push(variantChordTweak(source))
    else push(variantChordHeight(source, pick(HEIGHT_DELTAS)))
  }
  return variants.slice(0, count)
}

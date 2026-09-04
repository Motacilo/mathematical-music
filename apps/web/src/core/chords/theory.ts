import { KEY_NAMES, KEY_SOLFEGE } from '../scale'
import type {
  ChordBar,
  ChordNoteLabelMode,
  ChordQuality,
  QualityEnableMap,
} from '../projectTypes'
import type { ScaleType } from '../types'
import { ALL_CHORD_QUALITIES } from '../projectTypes'
import {
  rootDef,
  rootIdFromDegree,
  rootIdFromOffset,
  type ChordRootId,
  type RootEnableMap,
  enabledRoots,
} from './roots'

/** Interval sets from root (semitones) */
const QUALITY_INTERVALS: Record<ChordQuality, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  dom7: [0, 4, 7, 10],
  dim7: [0, 3, 6, 9],
  m7b5: [0, 3, 6, 10],
  maj6: [0, 4, 7, 9],
  min6: [0, 3, 7, 9],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
}

const QUALITY_SUFFIX: Record<ChordQuality, string> = {
  maj: '',
  min: 'm',
  dim: 'dim',
  aug: 'aug',
  maj7: 'maj7',
  min7: 'm7',
  dom7: '7',
  dim7: 'dim7',
  m7b5: 'm7♭5',
  maj6: '6',
  min6: 'm6',
  sus2: 'sus2',
  sus4: 'sus4',
}

/** Approximate diatonic degree 1–7 for a root (nearest scale step). */
export function approxDegreeFromOffset(
  rootOffset: number,
  scale: ScaleType,
): number {
  const id = rootIdFromOffset(rootOffset)
  const majorDeg: Partial<Record<ChordRootId, number>> = {
    I: 1,
    II: 2,
    III: 3,
    IV: 4,
    V: 5,
    VI: 6,
    VII: 7,
    bII: 2,
    bIII: 3,
    sIV: 4,
    bVI: 6,
    bVII: 7,
  }
  const minorDeg: Partial<Record<ChordRootId, number>> = {
    I: 1,
    II: 2,
    bIII: 3,
    III: 3,
    IV: 4,
    V: 5,
    bVI: 6,
    VI: 6,
    bVII: 7,
    VII: 7,
    bII: 2,
    sIV: 4,
  }
  return (scale === 'major' ? majorDeg : minorDeg)[id] ?? 1
}

export function resolveRootOffset(bar: ChordBar): number {
  if (typeof bar.rootOffset === 'number' && Number.isFinite(bar.rootOffset)) {
    return ((bar.rootOffset % 12) + 12) % 12
  }
  // Legacy: degree only
  const id = rootIdFromDegree(bar.degree || 1, bar.scale)
  return rootDef(id).offset
}

export function resolveRootId(bar: ChordBar): ChordRootId {
  if (bar.rootId) return bar.rootId
  return rootIdFromOffset(resolveRootOffset(bar))
}

/** Normalize older ChordBar drafts */
export function normalizeChordBar(bar: ChordBar): ChordBar {
  const rootId = resolveRootId(bar)
  const rootOffset = rootDef(rootId).offset
  return {
    ...bar,
    rootId,
    rootOffset,
    degree: bar.degree || approxDegreeFromOffset(rootOffset, bar.scale),
  }
}

export function defaultQualityForRoot(
  rootId: ChordRootId,
  scale: ScaleType,
): ChordQuality {
  // Rough diatonic defaults
  if (scale === 'major') {
    if (rootId === 'I' || rootId === 'IV') return 'maj'
    if (rootId === 'V') return 'maj'
    if (rootId === 'VII') return 'dim'
    if (rootId === 'II' || rootId === 'III' || rootId === 'VI') return 'min'
    if (rootId === 'bVII' || rootId === 'bIII' || rootId === 'bVI') return 'maj'
    return 'maj'
  }
  if (rootId === 'I' || rootId === 'IV') return 'min'
  if (rootId === 'V') return 'min'
  if (rootId === 'II') return 'dim'
  if (rootId === 'bIII' || rootId === 'bVI' || rootId === 'bVII') return 'maj'
  return 'min'
}

export function enabledQualities(map: QualityEnableMap): ChordQuality[] {
  return ALL_CHORD_QUALITIES.filter((q) => map[q])
}

export function pickQualityForRoot(
  rootId: ChordRootId,
  scale: ScaleType,
  qualityEnable: QualityEnableMap,
): ChordQuality {
  const pool = enabledQualities(qualityEnable)
  if (pool.length === 0) return defaultQualityForRoot(rootId, scale)
  const preferred = defaultQualityForRoot(rootId, scale)
  if (pool.includes(preferred)) return preferred
  return pool[Math.floor(Math.random() * pool.length)]!
}

export function romanFromRoot(
  rootId: ChordRootId,
  quality: ChordQuality,
): string {
  let base = rootDef(rootId).label
  // Case for minor-ish qualities on letter-like roman (I/II…)
  const lower =
    quality === 'min' ||
    quality === 'min7' ||
    quality === 'min6' ||
    quality === 'dim' ||
    quality === 'dim7' ||
    quality === 'm7b5'
  if (lower && !base.includes('♭') && !base.includes('♯')) {
    // only plain I–VII without accidentals get case fold
    if (['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'].includes(base)) {
      base = base.toLowerCase()
    }
  }

  if (quality === 'dim' || quality === 'dim7') {
    return `${base}°${quality === 'dim7' ? '7' : ''}`
  }
  if (quality === 'aug') return `${base}+`
  if (quality === 'maj7') return `${base}maj7`
  if (quality === 'min7') return `${base}7`
  if (quality === 'dom7') return `${base}7`
  if (quality === 'm7b5') return `${base}ø7`
  if (quality === 'maj6' || quality === 'min6') return `${base}6`
  if (quality === 'sus2') return `${base}sus2`
  if (quality === 'sus4') return `${base}sus4`
  return base
}

export function chordRootMidiFromOffset(
  rootOffset: number,
  keyRoot: number,
  octave = 3,
): number {
  return (octave + 1) * 12 + keyRoot + (((rootOffset % 12) + 12) % 12)
}

/** @deprecated prefer chordRootMidiFromBar */
export function chordRootMidi(
  degree: number,
  keyRoot: number,
  scale: ScaleType,
  octave = 3,
): number {
  const id = rootIdFromDegree(degree, scale)
  return chordRootMidiFromOffset(rootDef(id).offset, keyRoot, octave)
}

export function chordRootMidiFromBar(bar: ChordBar, octave = 3): number {
  return chordRootMidiFromOffset(
    resolveRootOffset(bar),
    bar.keyRoot,
    octave,
  )
}

/** Closed voicing pitches, MIDI */
export function chordPitches(
  degreeOrBar: number | ChordBar,
  quality?: ChordQuality,
  keyRoot?: number,
  scale?: ScaleType,
  octave = 3,
): number[] {
  let root: number
  let q: ChordQuality
  if (typeof degreeOrBar === 'object') {
    const bar = degreeOrBar
    root = chordRootMidiFromBar(bar, octave)
    q = bar.quality
  } else {
    root = chordRootMidi(degreeOrBar, keyRoot!, scale!, octave)
    q = quality!
  }
  const intervals = QUALITY_INTERVALS[q] ?? QUALITY_INTERVALS.maj
  return intervals.map((iv) => root + iv)
}

export function chordSymbolName(bar: ChordBar): string {
  const b = normalizeChordBar(bar)
  const rootMidi = chordRootMidiFromBar(b, 3)
  const pc = ((rootMidi % 12) + 12) % 12
  const name = KEY_NAMES[pc]!
  const suffix = QUALITY_SUFFIX[b.quality]
  const roman = romanFromRoot(b.rootId, b.quality)
  return `${roman} (${name}${suffix})`
}

export function chordDisplayName(bar: ChordBar): string {
  return chordSymbolName(bar)
}

export function chordToneLabels(
  bar: ChordBar,
  mode: ChordNoteLabelMode,
): string[] {
  const pitches = chordPitches(normalizeChordBar(bar), undefined, undefined, undefined, 3)
  return pitches.map((midi) => {
    const pc = ((midi % 12) + 12) % 12
    return mode === 'solfege' ? KEY_SOLFEGE[pc]! : KEY_NAMES[pc]!
  })
}

export function chordTonesLine(
  bar: ChordBar,
  mode: ChordNoteLabelMode,
): string {
  return chordToneLabels(bar, mode).join(' · ')
}

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function makeChordBarFromRoot(
  rootId: ChordRootId,
  quality: ChordQuality,
  keyRoot: number,
  scale: ScaleType,
  bpm: number,
): ChordBar {
  const offset = rootDef(rootId).offset
  return {
    id: uid('ch'),
    rootId,
    rootOffset: offset,
    degree: approxDegreeFromOffset(offset, scale),
    quality,
    keyRoot,
    scale,
    bpm,
  }
}

/** Legacy helper */
export function makeChordBar(
  degree: number,
  quality: ChordQuality,
  keyRoot: number,
  scale: ScaleType,
  bpm: number,
): ChordBar {
  return makeChordBarFromRoot(
    rootIdFromDegree(degree, scale),
    quality,
    keyRoot,
    scale,
    bpm,
  )
}

export function pickRootId(rootEnable: RootEnableMap): ChordRootId | null {
  const pool = enabledRoots(rootEnable)
  if (pool.length === 0) return null
  return pool[Math.floor(Math.random() * pool.length)]!
}

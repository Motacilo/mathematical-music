import type { Phrase, RhythmId, ScaleType } from './types'
import {
  createDefaultRootEnable,
  type ChordRootId,
  type RootEnableMap,
} from './chords/roots'

export type LayerKind = 'melody' | 'chords' | 'bass' | 'drums'

export type ChordQuality =
  | 'maj'
  | 'min'
  | 'dim'
  | 'aug'
  | 'maj7'
  | 'min7'
  | 'dom7'
  | 'dim7'
  | 'm7b5'
  | 'maj6'
  | 'min6'
  | 'sus2'
  | 'sus4'

export type ChordNoteLabelMode = 'letter' | 'solfege'

export type QualityEnableMap = Record<ChordQuality, boolean>

/** One bar = one chord (initial unit). */
export interface ChordBar {
  id: string
  /** Semitones from chord-layer tonic (0–11) */
  rootOffset: number
  /** Roman / chromatic root id */
  rootId: ChordRootId
  /** Legacy diatonic degree 1–7 (approx); kept for older drafts */
  degree: number
  quality: ChordQuality
  bpm: number
  keyRoot: number
  scale: ScaleType
  /** Play this bar as one held chord, ignoring the song's strum pattern. */
  sustain?: boolean
}

export type DrumInstrument = 'kick' | 'snare' | 'hat'

export interface DrumHit {
  instrument: DrumInstrument
  /** Position in beats from phrase start (0–based, 4/4 bar = 0..4) */
  beat: number
  duration: '16n' | '8n' | '4n'
}

export interface DrumPhrase {
  id: string
  bars: number
  bpm: number
  hits: DrumHit[]
  /** Pattern family id (optional for legacy drafts) */
  styleId?: string
  /** Display label e.g. エイトビート（アレンジ） */
  label?: string
  arranged?: boolean
}

export interface MixerState {
  volume: Record<LayerKind, number>
  mute: Record<LayerKind, boolean>
  solo: Record<LayerKind, boolean>
}

/** Which layers are included in arrange play / export */
export type LayerIncludeState = Record<LayerKind, boolean>

export interface KeySyncState {
  melody: boolean
  chords: boolean
  bass: boolean
}

export interface ProjectMeta {
  keyRoot: number
  scale: ScaleType
  bpm: number
}

export type ChordGenMode = 'random' | 'markov' | 'free'
export type BassGenMode = 'follow' | 'random'
export type ChordPlayStyleId =
  | 'block'
  | 'pulse'
  | 'arp_up'
  | 'arp_down'
  | 'arp_wave'
  | 'broken'
  | 'alberti'
  | 'random'

export interface ChordsLayerState {
  mode: ChordGenMode
  barCount: number
  candidateCount: number
  candidates: ChordBar[][]
  stage: ChordBar[]
  /** Layer-local key when sync off */
  keyRoot: number
  scale: ScaleType
  /** Pitch names under chord: C E G vs ド ミ ソ */
  noteLabelMode: ChordNoteLabelMode
  /** Allowed chord qualities (maj7, sus, …) */
  qualityEnable: QualityEnableMap
  /** Allowed roots: I–VII and chromatic (♭II …) */
  rootEnable: RootEnableMap
  /** How chords are articulated on play / mix export */
  playStyle: ChordPlayStyleId
}
export type DrumStyleSelect =
  | 'any'
  | 'four_on_floor'
  | 'eight_beat'
  | 'sixteen_beat'
  | 'rock'
  | 'half_time'
  | 'disco'
  | 'ballad'
export type DrumArrangeMode = 'clean' | 'light' | 'mixed'

export interface BassLayerState {
  mode: BassGenMode
  rhythmId: RhythmId
  barCount: number
  candidateCount: number
  candidates: Phrase[]
  stage: Phrase[]
  keyRoot: number
  scale: ScaleType
  octave: number
}

export interface DrumsLayerState {
  /** Arrange intensity 0–100 (used when ちょいアレンジ / 混在) */
  density: number
  barCount: number
  candidateCount: number
  styleId: DrumStyleSelect
  arrangeMode: DrumArrangeMode
  candidates: DrumPhrase[]
  stage: DrumPhrase[]
}

export function createDefaultMixer(): MixerState {
  return {
    volume: { melody: 0.85, chords: 0.55, bass: 0.7, drums: 0.75 },
    mute: { melody: false, chords: false, bass: false, drums: false },
    solo: { melody: false, chords: false, bass: false, drums: false },
  }
}

export function createDefaultLayerInclude(): LayerIncludeState {
  return { melody: true, chords: true, bass: true, drums: true }
}

export function createDefaultKeySync(): KeySyncState {
  return { melody: true, chords: true, bass: true }
}

export const ALL_CHORD_QUALITIES: ChordQuality[] = [
  'maj',
  'min',
  'dim',
  'aug',
  'maj7',
  'min7',
  'dom7',
  'dim7',
  'm7b5',
  'maj6',
  'min6',
  'sus2',
  'sus4',
]

export const CHORD_QUALITY_LABELS: Record<ChordQuality, string> = {
  maj: 'メジャー',
  min: 'マイナー',
  dim: 'dim',
  aug: 'aug',
  maj7: 'maj7',
  min7: 'm7',
  dom7: '7（ドミナント）',
  dim7: 'dim7',
  m7b5: 'm7♭5',
  maj6: '6',
  min6: 'm6',
  sus2: 'sus2',
  sus4: 'sus4',
}

export function createDefaultQualityEnable(): QualityEnableMap {
  return {
    maj: true,
    min: true,
    dim: true,
    aug: false,
    maj7: false,
    min7: false,
    dom7: false,
    dim7: false,
    m7b5: false,
    maj6: false,
    min6: false,
    sus2: false,
    sus4: false,
  }
}

export function createDefaultChordsLayer(
  meta: ProjectMeta,
): ChordsLayerState {
  return {
    mode: 'markov',
    barCount: 4,
    candidateCount: 6,
    candidates: [],
    stage: [],
    keyRoot: meta.keyRoot,
    scale: meta.scale,
    noteLabelMode: 'letter',
    qualityEnable: createDefaultQualityEnable(),
    rootEnable: createDefaultRootEnable(meta.scale),
    playStyle: 'block',
  }
}

export function createDefaultBassLayer(meta: ProjectMeta): BassLayerState {
  return {
    mode: 'follow',
    rhythmId: 'quarters',
    barCount: 4,
    candidateCount: 6,
    candidates: [],
    stage: [],
    keyRoot: meta.keyRoot,
    scale: meta.scale,
    octave: 3,
  }
}

export function createDefaultDrumsLayer(): DrumsLayerState {
  return {
    density: 45,
    barCount: 2,
    candidateCount: 6,
    styleId: 'any',
    arrangeMode: 'mixed',
    candidates: [],
    stage: [],
  }
}

export const LAYER_LABELS: Record<LayerKind, string> = {
  melody: 'メロディ',
  chords: 'コード',
  bass: 'ベース',
  drums: 'リズム',
}

export const LAYER_ROUTES: {
  kind: LayerKind | 'arrange' | 'start'
  path: string
  label: string
}[] = [
    { kind: 'start', path: '/layer/start', label: 'はじめる' },
    { kind: 'melody', path: '/layer/melody', label: 'メロディ' },
    { kind: 'chords', path: '/layer/chords', label: 'コード' },
    { kind: 'bass', path: '/layer/bass', label: 'ベース' },
    { kind: 'drums', path: '/layer/drums', label: 'リズム' },
    { kind: 'arrange', path: '/layer/arrange', label: '出力' },
  ]

import type { ScaleType } from '../types'

/** All selectable chord roots (12 pitch classes from tonic). */
export type ChordRootId =
  | 'I'
  | 'bII'
  | 'II'
  | 'bIII'
  | 'III'
  | 'IV'
  | 'sIV'
  | 'V'
  | 'bVI'
  | 'VI'
  | 'bVII'
  | 'VII'

export type RootEnableMap = Record<ChordRootId, boolean>

export interface ChordRootDef {
  id: ChordRootId
  /** Semitones above tonic */
  offset: number
  label: string
  /** In major diatonic set */
  inMajor: boolean
  /** In natural minor diatonic set */
  inMinor: boolean
}

export const CHORD_ROOT_DEFS: ChordRootDef[] = [
  { id: 'I', offset: 0, label: 'I', inMajor: true, inMinor: true },
  { id: 'bII', offset: 1, label: '♭II', inMajor: false, inMinor: false },
  { id: 'II', offset: 2, label: 'II', inMajor: true, inMinor: true },
  { id: 'bIII', offset: 3, label: '♭III', inMajor: false, inMinor: true },
  { id: 'III', offset: 4, label: 'III', inMajor: true, inMinor: false },
  { id: 'IV', offset: 5, label: 'IV', inMajor: true, inMinor: true },
  { id: 'sIV', offset: 6, label: '♯IV / ♭V', inMajor: false, inMinor: false },
  { id: 'V', offset: 7, label: 'V', inMajor: true, inMinor: true },
  { id: 'bVI', offset: 8, label: '♭VI', inMajor: false, inMinor: true },
  { id: 'VI', offset: 9, label: 'VI', inMajor: true, inMinor: false },
  { id: 'bVII', offset: 10, label: '♭VII', inMajor: false, inMinor: true },
  { id: 'VII', offset: 11, label: 'VII', inMajor: true, inMinor: false },
]

export const ALL_CHORD_ROOTS: ChordRootId[] = CHORD_ROOT_DEFS.map((d) => d.id)

export function createDefaultRootEnable(scale: ScaleType = 'major'): RootEnableMap {
  const map = {} as RootEnableMap
  for (const def of CHORD_ROOT_DEFS) {
    map[def.id] = scale === 'major' ? def.inMajor : def.inMinor
  }
  return map
}

export function rootDef(id: ChordRootId): ChordRootDef {
  return CHORD_ROOT_DEFS.find((d) => d.id === id)!
}

export function rootIdFromOffset(offset: number): ChordRootId {
  const o = ((offset % 12) + 12) % 12
  return CHORD_ROOT_DEFS.find((d) => d.offset === o)?.id ?? 'I'
}

/** Legacy diatonic degree 1–7 → root id for a scale */
export function rootIdFromDegree(degree: number, scale: ScaleType): ChordRootId {
  const d = ((degree - 1) % 7) + 1
  const majorMap: ChordRootId[] = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']
  const minorMap: ChordRootId[] = ['I', 'II', 'bIII', 'IV', 'V', 'bVI', 'bVII']
  const list = scale === 'major' ? majorMap : minorMap
  return list[d - 1]!
}

export function enabledRoots(map: RootEnableMap): ChordRootId[] {
  return ALL_CHORD_ROOTS.filter((id) => map[id])
}

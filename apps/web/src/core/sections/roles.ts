import { uid } from '../chords/theory'

export type SectionRole =
  | 'intro'
  | 'a'
  | 'b'
  | 'chorus'
  | 'interlude'
  | 'c'
  | 'outro'

export interface SongSection {
  id: string
  role: SectionRole
  bars: number
  /** Timeline position in bars, from the start of the song */
  startBar: number
}

export const SECTION_BAR_OPTIONS = [2, 4, 8, 12, 16] as const

export const SECTION_CANDIDATE_COUNT = 3

export const SECTION_ROLES: readonly {
  id: SectionRole
  label: string
  blurb: string
  defaultBars: number
}[] = [
  { id: 'intro', label: 'イントロ', blurb: '静かにはじまる', defaultBars: 4 },
  { id: 'a', label: 'Aメロ', blurb: '歌の入り', defaultBars: 8 },
  { id: 'b', label: 'Bメロ', blurb: 'サビの前', defaultBars: 8 },
  { id: 'chorus', label: 'サビ', blurb: 'いちばん盛り上がる', defaultBars: 8 },
  { id: 'interlude', label: '間奏', blurb: 'サビのあとのひと休み', defaultBars: 4 },
  { id: 'c', label: 'Cメロ', blurb: '少し別の景色', defaultBars: 8 },
  { id: 'outro', label: '後奏', blurb: '曲をとじる', defaultBars: 4 },
]

/** One pass from the opening to the ending. Phrase mode can still pick any role. */
export const FULL_SONG_ROLES: readonly SectionRole[] = [
  'intro',
  'a',
  'b',
  'chorus',
  'interlude',
  'a',
  'b',
  'chorus',
  'c',
  'chorus',
  'outro',
]

const ROLE_IDS = new Set<string>(SECTION_ROLES.map((r) => r.id))

export function isSectionRole(value: unknown): value is SectionRole {
  return typeof value === 'string' && ROLE_IDS.has(value)
}

export function sectionRoleMeta(role: SectionRole) {
  return SECTION_ROLES.find((r) => r.id === role) ?? SECTION_ROLES[0]!
}

export function sectionRoleLabel(role: SectionRole): string {
  return sectionRoleMeta(role).label
}

export function normalizeSections(value: unknown): SongSection[] {
  if (!Array.isArray(value)) return []
  const out: SongSection[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const raw = item as Partial<SongSection>
    if (!isSectionRole(raw.role)) continue
    const bars = Math.round(Number(raw.bars))
    const startBar = Math.round(Number(raw.startBar))
    if (!Number.isFinite(bars) || bars < 1) continue
    if (!Number.isFinite(startBar) || startBar < 0) continue
    out.push({
      id: typeof raw.id === 'string' && raw.id ? raw.id : uid('sec'),
      role: raw.role,
      bars,
      startBar,
    })
  }
  return out.sort((a, b) => a.startBar - b.startBar)
}

/** Next role to offer after the one just added. The user can still pick another. */
export function suggestNextRole(last: SectionRole | null): SectionRole {
  if (last == null) return 'intro'
  if (last === 'intro') return 'a'
  if (last === 'a') return 'b'
  if (last === 'b') return 'chorus'
  if (last === 'chorus') return 'interlude'
  if (last === 'interlude') return 'a'
  if (last === 'c') return 'chorus'
  return 'outro'
}

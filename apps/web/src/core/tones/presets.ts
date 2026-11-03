export type ToneId = 'piano' | 'soft' | 'guitar'

export type ToneLayer = 'melody' | 'chords' | 'bass'

export type ToneMap = Record<ToneLayer, ToneId>

export const TONE_OPTIONS: readonly { id: ToneId; label: string }[] = [
  { id: 'piano', label: 'ピアノ' },
  { id: 'soft', label: 'やわらかい' },
  { id: 'guitar', label: 'ギター' },
]

export const TONE_LAYER_LABELS: Record<ToneLayer, string> = {
  melody: 'メロディ',
  chords: 'コード',
  bass: 'ベース',
}

/** General MIDI program numbers. Bass uses bass-family patches. */
const GM_LEAD: Record<ToneId, number> = {
  piano: 0,
  soft: 89,
  guitar: 25,
}

const GM_BASS: Record<ToneId, number> = {
  piano: 32,
  soft: 38,
  guitar: 33,
}

export function createDefaultTones(): ToneMap {
  return { melody: 'piano', chords: 'piano', bass: 'piano' }
}

export function gmProgram(layer: ToneLayer, id: ToneId): number {
  return layer === 'bass' ? GM_BASS[id] : GM_LEAD[id]
}

const TONE_IDS: readonly ToneId[] = ['piano', 'soft', 'guitar']

export function isToneId(value: unknown): value is ToneId {
  return typeof value === 'string' && (TONE_IDS as readonly string[]).includes(value)
}

export function normalizeToneMap(value: Partial<ToneMap> | undefined): ToneMap {
  const fallback = createDefaultTones()
  if (!value) return fallback
  return {
    melody: isToneId(value.melody) ? value.melody : fallback.melody,
    chords: isToneId(value.chords) ? value.chords : fallback.chords,
    bass: isToneId(value.bass) ? value.bass : fallback.bass,
  }
}

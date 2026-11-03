/** Tone-free helpers shared by the export UI (kept out of the lazily loaded wav module). */
import type {
  ChordBar,
  DrumPhrase,
  LayerIncludeState,
} from '../core/projectTypes'
import type { Phrase } from '../core/types'

export type WavLayers = {
  melody?: Phrase[]
  chords?: ChordBar[]
  bass?: Phrase[]
  drums?: DrumPhrase[]
}

export function filterLayersByInclude(
  layers: WavLayers,
  include: LayerIncludeState,
): WavLayers {
  return {
    melody: include.melody && layers.melody?.length ? layers.melody : undefined,
    chords: include.chords && layers.chords?.length ? layers.chords : undefined,
    bass: include.bass && layers.bass?.length ? layers.bass : undefined,
    drums: include.drums && layers.drums?.length ? layers.drums : undefined,
  }
}

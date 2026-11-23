import { useProject } from '../core/ProjectContext'
import { LAYER_LABELS, type LayerKind } from '../core/projectTypes'
import './VolumeMixer.css'

const KINDS: LayerKind[] = ['melody', 'chords', 'bass', 'drums']

/** Per-part volume (rhythm included). Applies from the next play or export. */
export function VolumeMixer() {
  const { draft, setMixer } = useProject()
  return (
    <div className="volume-mixer">
      {KINDS.map((kind) => (
        <label key={kind} className="volume-mixer__row">
          <span className="volume-mixer__label">{LAYER_LABELS[kind]}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={draft.mixer.volume[kind]}
            onChange={(e) =>
              setMixer({
                ...draft.mixer,
                volume: { ...draft.mixer.volume, [kind]: Number(e.target.value) },
              })
            }
          />
          <span className="volume-mixer__value">
            {Math.round(draft.mixer.volume[kind] * 100)}
          </span>
        </label>
      ))}
    </div>
  )
}

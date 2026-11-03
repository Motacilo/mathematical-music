import {
  TONE_LAYER_LABELS,
  TONE_OPTIONS,
  type ToneLayer,
  type ToneMap,
} from '../core/tones/presets'
import './TonePicker.css'

const LAYERS: ToneLayer[] = ['melody', 'chords', 'bass']

type TonePickerProps = {
  tones: ToneMap
  onChange: (patch: Partial<ToneMap>) => void
}

export function TonePicker({ tones, onChange }: TonePickerProps) {
  return (
    <div className="tone-picker">
      {LAYERS.map((layer) => (
        <div key={layer} className="tone-row">
          <span className="tone-row__label">{TONE_LAYER_LABELS[layer]}</span>
          <div className="tone-row__choices" role="group" aria-label={TONE_LAYER_LABELS[layer]}>
            {TONE_OPTIONS.map((opt) => {
              const selected = tones[layer] === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`tone-choice${selected ? ' is-selected' : ''}`}
                  aria-pressed={selected}
                  onClick={() => onChange({ [layer]: opt.id })}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

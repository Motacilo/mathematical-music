import { KEY_NAMES, keyOptionLabel } from '../core/scale'
import './SectionTuneBar.css'

interface SectionTuneBarProps {
  keyRoot: number
  bpmInput: string
  disabled?: boolean
  onKeyChange: (keyRoot: number) => void
  onBpmInputChange: (value: string) => void
  onBpmCommit: () => void
}

export function SectionTuneBar({
  keyRoot,
  bpmInput,
  disabled = false,
  onKeyChange,
  onBpmInputChange,
  onBpmCommit,
}: SectionTuneBarProps) {
  return (
    <div className={`section-tune${disabled ? ' is-disabled' : ''}`}>
      <label>
        キー
        <select
          value={keyRoot}
          disabled={disabled}
          onChange={(e) => onKeyChange(Number(e.target.value))}
        >
          {KEY_NAMES.map((name, i) => (
            <option key={name} value={i}>
              {keyOptionLabel(i)}
            </option>
          ))}
        </select>
      </label>
      <label>
        BPM
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          disabled={disabled}
          value={bpmInput}
          onChange={(e) => {
            const next = e.target.value
            if (next === '' || /^\d+$/.test(next)) {
              onBpmInputChange(next)
            }
          }}
          onBlur={onBpmCommit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              ;(e.target as HTMLInputElement).blur()
            }
          }}
        />
      </label>
    </div>
  )
}

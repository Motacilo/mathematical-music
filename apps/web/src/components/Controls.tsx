import { KEY_NAMES } from '../core/scale'
import { RHYTHM_LABELS } from '../core/rhythm'
import { validateExpr, looksLikeExpression } from '../core/expr'
import {
  midiFromNoteOctave,
  noteOctaveFromMidi,
  buildSequencePitchRange,
} from '../core/sequenceRange'
import type {
  DistributionParams,
  GenMode,
  ProjectSettings,
  RhythmId,
  ScaleType,
  SequenceParams,
} from '../core/types'
import { DistributionChart } from './DistributionChart'
import './Controls.css'

interface ControlsProps {
  mode: GenMode
  settings: ProjectSettings
  bpmInput: string
  onBpmInputChange: (value: string) => void
  restProbInput: string
  onRestProbInputChange: (value: string) => void
  distribution: DistributionParams
  sequence: SequenceParams
  onModeChange: (mode: GenMode) => void
  onSettingsChange: (patch: Partial<ProjectSettings>) => void
  onDistributionChange: (patch: Partial<DistributionParams>) => void
  onSequenceChange: (patch: Partial<SequenceParams>) => void
  onGenerate: () => void
}

export function Controls({
  mode,
  settings,
  bpmInput,
  onBpmInputChange,
  restProbInput,
  onRestProbInputChange,
  distribution,
  sequence,
  onModeChange,
  onSettingsChange,
  onDistributionChange,
  onSequenceChange,
  onGenerate,
}: ControlsProps) {
  return (
    <div className="controls">
      <div className="controls__row">
        <label>
          モード
          <select
            value={mode}
            onChange={(e) => onModeChange(e.target.value as GenMode)}
          >
            <option value="distribution">分布</option>
            <option value="sequence">数列</option>
          </select>
        </label>

        <label>
          キー
          <select
            value={settings.keyRoot}
            onChange={(e) =>
              onSettingsChange({ keyRoot: Number(e.target.value) })
            }
          >
            {KEY_NAMES.map((name, i) => (
              <option key={name} value={i}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label>
          スケール
          <select
            value={settings.scale}
            onChange={(e) =>
              onSettingsChange({ scale: e.target.value as ScaleType })
            }
          >
            <option value="major">メジャー</option>
            <option value="minor">マイナー</option>
          </select>
        </label>

        <label>
          BPM
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={bpmInput}
            onChange={(e) => {
              const next = e.target.value
              if (next === '' || /^\d+$/.test(next)) {
                onBpmInputChange(next)
              }
            }}
          />
        </label>

        <label>
          リズム
          <select
            value={settings.rhythmId}
            onChange={(e) =>
              onSettingsChange({ rhythmId: e.target.value as RhythmId })
            }
          >
            {(Object.keys(RHYTHM_LABELS) as RhythmId[]).map((id) => (
              <option key={id} value={id}>
                {RHYTHM_LABELS[id]}
              </option>
            ))}
          </select>
        </label>

        <label>
          候補数
          <select
            value={settings.candidateCount}
            onChange={(e) =>
              onSettingsChange({
                candidateCount: Number(e.target.value),
              })
            }
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <label>
          休符確率 %
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={restProbInput}
            onChange={(e) => {
              const next = e.target.value
              if (next === '' || /^\d+$/.test(next)) {
                onRestProbInputChange(next)
              }
            }}
          />
        </label>
      </div>

      {mode === 'distribution' && (
        <div className="controls__row controls__row--mode controls__row--dist">
          <DistributionChart
            distribution={distribution}
            keyRoot={settings.keyRoot}
            scale={settings.scale}
            onChange={onDistributionChange}
          />
        </div>
      )}

      {mode === 'sequence' && (
        <div className="controls__row controls__row--mode controls__row--seq">
          <label className="controls__grow">
            式（n は 0 始まり）またはカンマ区切り
            <input
              type="text"
              value={sequence.expression}
              onChange={(e) =>
                onSequenceChange({ expression: e.target.value })
              }
              placeholder="例: n  /  2*n+1  /  n^2  /  1,3,5,2"
              spellCheck={false}
            />
          </label>

          <div className="controls__seq-range">
            <label>
              下限
              <span className="controls__note-pick">
                <select
                  value={noteOctaveFromMidi(sequence.rangeLowMidi).pc}
                  onChange={(e) => {
                    const { octave } = noteOctaveFromMidi(sequence.rangeLowMidi)
                    onSequenceChange({
                      rangeLowMidi: midiFromNoteOctave(
                        Number(e.target.value),
                        octave,
                      ),
                    })
                  }}
                >
                  {KEY_NAMES.map((name, i) => (
                    <option key={name} value={i}>
                      {name}
                    </option>
                  ))}
                </select>
                <select
                  value={noteOctaveFromMidi(sequence.rangeLowMidi).octave}
                  onChange={(e) => {
                    const { pc } = noteOctaveFromMidi(sequence.rangeLowMidi)
                    onSequenceChange({
                      rangeLowMidi: midiFromNoteOctave(
                        pc,
                        Number(e.target.value),
                      ),
                    })
                  }}
                >
                  {[1, 2, 3, 4, 5, 6].map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </span>
            </label>

            <label>
              上限
              <span className="controls__note-pick">
                <select
                  value={noteOctaveFromMidi(sequence.rangeHighMidi).pc}
                  onChange={(e) => {
                    const { octave } = noteOctaveFromMidi(
                      sequence.rangeHighMidi,
                    )
                    onSequenceChange({
                      rangeHighMidi: midiFromNoteOctave(
                        Number(e.target.value),
                        octave,
                      ),
                    })
                  }}
                >
                  {KEY_NAMES.map((name, i) => (
                    <option key={name} value={i}>
                      {name}
                    </option>
                  ))}
                </select>
                <select
                  value={noteOctaveFromMidi(sequence.rangeHighMidi).octave}
                  onChange={(e) => {
                    const { pc } = noteOctaveFromMidi(sequence.rangeHighMidi)
                    onSequenceChange({
                      rangeHighMidi: midiFromNoteOctave(
                        pc,
                        Number(e.target.value),
                      ),
                    })
                  }}
                >
                  {[1, 2, 3, 4, 5, 6].map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </span>
            </label>

            <label className="controls__check">
              <input
                type="checkbox"
                checked={sequence.chromaticSteps}
                onChange={(e) =>
                  onSequenceChange({ chromaticSteps: e.target.checked })
                }
              />
              半音ステップ
            </label>
          </div>

          <p className="controls__hint">
            {(() => {
              const count = buildSequencePitchRange(
                sequence.rangeLowMidi,
                sequence.rangeHighMidi,
                settings.keyRoot,
                settings.scale,
                sequence.chromaticSteps,
              ).length
              const expr = sequence.expression.trim() || 'n'
              const check =
                looksLikeExpression(expr) || /[nN]/.test(expr)
                  ? validateExpr(expr)
                  : { ok: true as const, value: 0 }
              return (
                <>
                  範囲内の音は {count} 個（
                  {sequence.chromaticSteps ? '半音' : 'キー内'}
                  ）。結果は round のあと 0..{Math.max(0, count - 1)}{' '}
                  でループ。休符では n は進みません。
                  {!check.ok && (
                    <span className="controls__error"> — {check.error}</span>
                  )}
                </>
              )
            })()}
          </p>
        </div>
      )}

      <div className="controls__actions">
        <button type="button" className="btn btn--primary" onClick={onGenerate}>
          生成
        </button>
      </div>
    </div>
  )
}

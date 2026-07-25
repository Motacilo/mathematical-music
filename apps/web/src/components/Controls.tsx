import {
  KEY_NAMES,
  OCTAVE_OPTIONS,
  keyOptionLabel,
  octaveOptionLabel,
} from '../core/scale'
import { RHYTHM_LABELS } from '../core/rhythm'
import { validateExpr, looksLikeExpression } from '../core/expr'
import {
  midiFromNoteOctave,
  noteOctaveFromMidi,
  buildSequencePitchRange,
} from '../core/sequenceRange'
import type {
  BarCount,
  DistributionParams,
  GenMode,
  ProjectSettings,
  RhythmId,
  ScaleType,
  SequenceParams,
} from '../core/types'
import { DistributionChart } from './DistributionChart'
import { maxCandidateCount } from '../core/generators'
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
  const maxCandidates = maxCandidateCount(settings.barCount)
  const candidateOptions = Array.from({ length: maxCandidates }, (_, i) => i + 1)
  const candidateValue = Math.min(maxCandidates, settings.candidateCount)

  return (
    <div className="controls">
      <div className="controls__intro">
        <h2 className="controls__title">設定</h2>
        <p className="controls__intro-text">
          まずモードとキーを選び、「生成」で候補フレーズを作ります。気に入ったものを譜面へ並べてメロディにしましょう。
        </p>
      </div>

      <div className="controls__row">
        <label>
          モード
          <select
            value={mode}
            onChange={(e) => onModeChange(e.target.value as GenMode)}
          >
            <option value="distribution">分布（確率で音を選ぶ）</option>
            <option value="sequence">数列（式・数字で並べる）</option>
          </select>
        </label>

        <label>
          キー（主音）
          <select
            value={settings.keyRoot}
            onChange={(e) =>
              onSettingsChange({ keyRoot: Number(e.target.value) })
            }
          >
            {KEY_NAMES.map((name, i) => (
              <option key={name} value={i}>
                {keyOptionLabel(i)}
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
            <option value="major">メジャー（明るい）</option>
            <option value="minor">マイナー（暗い）</option>
          </select>
        </label>

        <label>
          BPM（速さ）
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
      </div>

      <div className="controls__row">
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
          小節数
          <select
            value={settings.barCount}
            onChange={(e) =>
              onSettingsChange({
                barCount: Number(e.target.value) as BarCount,
              })
            }
          >
            {([1, 2, 3, 4] as const).map((n) => (
              <option key={n} value={n}>
                {n}小節
              </option>
            ))}
          </select>
        </label>

        <label>
          候補数
          <select
            value={candidateValue}
            onChange={(e) =>
              onSettingsChange({
                candidateCount: Number(e.target.value),
              })
            }
          >
            {candidateOptions.map((n) => (
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
      <p className="controls__hint controls__hint--top">
        小節数は1候補の長さ（最大4）。1〜2小節は1枠・候補最大8、3〜4小節は2枠分・候補最大4です。リズムの表記は1小節あたり。BPM
        は速さ、休符確率は各音符が休符になる割合（0%=なし、100%=全部休符）。
      </p>

      {mode === 'distribution' && (
        <div className="controls__row controls__row--mode controls__row--dist">
          <p className="controls__mode-lead">
            <strong>分布モード：</strong>
            棒の高い音ほど出やすくなります。プリセットを選ぶか、棒をドラッグして確率を変え、「生成」を押してください。
          </p>
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
          <p className="controls__mode-lead">
            <strong>数列モード：</strong>
            <code>n</code> は 0,1,2… と進みます（休符のときは進みません）。例:{' '}
            <code>n</code>、<code>2*n+1</code>、<code>n^2</code>
            。カンマ区切りの数字列も使えます。
          </p>
          <label className="controls__grow">
            式またはカンマ区切りの数字
            <input
              type="text"
              value={sequence.expression}
              onChange={(e) =>
                onSequenceChange({ expression: e.target.value })
              }
              placeholder="例: n  /  2*n+1  /  n^2  /  0,2,4,7"
              spellCheck={false}
            />
          </label>

          <div className="controls__seq-range">
            <label>
              いちばん低い音
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
                    {keyOptionLabel(i)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              音の高さ
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
                {OCTAVE_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {octaveOptionLabel(o)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              いちばん高い音
              <select
                value={noteOctaveFromMidi(sequence.rangeHighMidi).pc}
                onChange={(e) => {
                  const { octave } = noteOctaveFromMidi(sequence.rangeHighMidi)
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
                    {keyOptionLabel(i)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              音の高さ
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
                {OCTAVE_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {octaveOptionLabel(o)}
                  </option>
                ))}
              </select>
            </label>

            <label className="controls__check">
              <input
                type="checkbox"
                checked={sequence.chromaticSteps}
                onChange={(e) =>
                  onSequenceChange({ chromaticSteps: e.target.checked })
                }
              />
              半音ステップ（キー外の音も含める）
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
                  いまの範囲には音が {count} 個あります（
                  {sequence.chromaticSteps ? '半音すべて' : 'キー内のみ'}
                  ）。計算結果は四捨五入し、範囲をはみ出したら最初に戻ります。
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
        <p className="controls__actions-hint">
          押すと下に候補が出ます →「聴く」→「譜面へ」（複数小節は小節ごとに分割して並びます）
        </p>
      </div>
    </div>
  )
}

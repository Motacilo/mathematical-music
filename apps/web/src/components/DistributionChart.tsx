import { useCallback, useEffect, useRef } from 'react'
import {
  HALF_RANGE_OPTIONS,
  PRESET_LABELS,
  getDistributionPitches,
  isPitchInScale,
  normalizeWeights,
  pitchLabel,
  presetUsesSigma,
  remapWeightsForRange,
  weightsFromPreset,
  type DistPresetId,
} from '../core/distributionWeights'
import { KEY_NAMES } from '../core/scale'
import type { DistributionParams, ScaleType } from '../core/types'
import './DistributionChart.css'

interface DistributionChartProps {
  distribution: DistributionParams
  keyRoot: number
  scale: ScaleType
  onChange: (patch: Partial<DistributionParams>) => void
}

export function DistributionChart({
  distribution,
  keyRoot,
  scale,
  onChange,
}: DistributionChartProps) {
  const pitches = getDistributionPitches(
    distribution.centerMidi,
    distribution.halfRange,
  )
  const chartRef = useRef<HTMLDivElement>(null)
  const dragIndex = useRef<number | null>(null)

  const maxW = Math.max(...distribution.weights, 0.001)
  const probs = normalizeWeights(distribution.weights)
  const centerPc = ((distribution.centerMidi % 12) + 12) % 12
  const centerOct = Math.floor(distribution.centerMidi / 12) - 1

  const buildPresetWeights = useCallback(
    (
      preset: Exclude<DistPresetId, 'custom'>,
      halfRange = distribution.halfRange,
      sigma = distribution.sigma,
      centerMidi = distribution.centerMidi,
      excludeOutOfKey = distribution.excludeOutOfKey,
    ) =>
      weightsFromPreset(preset, halfRange, sigma, {
        excludeOutOfKey,
        centerMidi,
        keyRoot,
        scale,
      }),
    [
      distribution.halfRange,
      distribution.sigma,
      distribution.centerMidi,
      distribution.excludeOutOfKey,
      keyRoot,
      scale,
    ],
  )

  const setWeightAt = useCallback(
    (index: number, clientY: number) => {
      const el = chartRef.current
      if (!el) return
      const col = el.children[index] as HTMLElement | undefined
      const track = col?.querySelector(
        '.dist-chart__track',
      ) as HTMLElement | null
      const rect = (track ?? el).getBoundingClientRect()
      const y = clientY - rect.top
      const ratio = 1 - y / rect.height
      const visual = Math.max(0, Math.min(1, ratio))
      const next = visual * visual
      const weights = distribution.weights.map((w, i) =>
        i === index ? next : w,
      )
      onChange({ weights, activePreset: 'custom' })
    },
    [distribution.weights, onChange],
  )

  const onPointerDown = (index: number, e: React.PointerEvent) => {
    e.preventDefault()
    dragIndex.current = index
    chartRef.current?.setPointerCapture?.(e.pointerId)
    setWeightAt(index, e.clientY)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragIndex.current == null) return
    setWeightAt(dragIndex.current, e.clientY)
  }

  const onPointerUp = () => {
    dragIndex.current = null
  }

  const applyPreset = (preset: Exclude<DistPresetId, 'custom'>) => {
    onChange({
      activePreset: preset,
      weights: buildPresetWeights(preset),
    })
  }

  const rebuildPresetWeights = (
    patch: Partial<DistributionParams>,
    preset: DistPresetId = distribution.activePreset,
  ) => {
    const halfRange = patch.halfRange ?? distribution.halfRange
    const sigma = patch.sigma ?? distribution.sigma
    const centerMidi = patch.centerMidi ?? distribution.centerMidi
    const excludeOutOfKey =
      patch.excludeOutOfKey ?? distribution.excludeOutOfKey
    if (preset === 'custom') {
      onChange(patch)
      return
    }
    onChange({
      ...patch,
      activePreset: preset,
      weights: buildPresetWeights(
        preset,
        halfRange,
        sigma,
        centerMidi,
        excludeOutOfKey,
      ),
    })
  }

  const setCenterPc = (pc: number) => {
    const midi = (centerOct + 1) * 12 + pc
    const centerMidi = Math.max(0, Math.min(127, midi))
    if (distribution.activePreset === 'custom') {
      onChange({ centerMidi })
      return
    }
    rebuildPresetWeights({ centerMidi }, distribution.activePreset)
  }

  const setCenterOct = (oct: number) => {
    const midi = (oct + 1) * 12 + centerPc
    const centerMidi = Math.max(0, Math.min(127, midi))
    if (distribution.activePreset === 'custom') {
      onChange({ centerMidi })
      return
    }
    rebuildPresetWeights({ centerMidi }, distribution.activePreset)
  }

  const setHalfRange = (halfRange: number) => {
    if (distribution.activePreset === 'custom') {
      onChange({
        halfRange,
        weights: remapWeightsForRange(
          distribution.weights,
          distribution.halfRange,
          halfRange,
        ),
      })
      return
    }
    rebuildPresetWeights({ halfRange }, distribution.activePreset)
  }

  const setExcludeOutOfKey = (excludeOutOfKey: boolean) => {
    // カスタムの重みは触らない
    if (distribution.activePreset === 'custom') {
      onChange({ excludeOutOfKey })
      return
    }
    rebuildPresetWeights({ excludeOutOfKey }, distribution.activePreset)
  }

  // キー／スケール変更時、プリセット＋キー外除外なら重みを再適用
  useEffect(() => {
    if (distribution.activePreset === 'custom') return
    if (!distribution.excludeOutOfKey) return
    onChange({ weights: buildPresetWeights(distribution.activePreset) })
    // キー／スケール変化時のみ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyRoot, scale])

  return (
    <div className="dist-chart">
      <div className="dist-chart__presets">
        {(Object.keys(PRESET_LABELS) as Exclude<DistPresetId, 'custom'>[]).map(
          (id) => (
            <button
              key={id}
              type="button"
              className={`dist-chart__preset${distribution.activePreset === id ? ' is-active' : ''}`}
              onClick={() => applyPreset(id)}
            >
              {PRESET_LABELS[id]}
            </button>
          ),
        )}
        {distribution.activePreset === 'custom' && (
          <span className="dist-chart__custom-badge">カスタム</span>
        )}
      </div>

      <div className="dist-chart__sliders">
        <label>
          中心音
          <span className="dist-chart__center-pick">
            <select
              value={centerPc}
              onChange={(e) => setCenterPc(Number(e.target.value))}
            >
              {KEY_NAMES.map((name, i) => (
                <option key={name} value={i}>
                  {name}
                </option>
              ))}
            </select>
            <select
              value={centerOct}
              onChange={(e) => setCenterOct(Number(e.target.value))}
            >
              {[2, 3, 4, 5, 6].map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </span>
        </label>

        <label>
          分布の幅
          <select
            value={distribution.halfRange}
            onChange={(e) => setHalfRange(Number(e.target.value))}
          >
            {HALF_RANGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label
          className={
            !presetUsesSigma(distribution.activePreset)
              ? 'is-disabled'
              : undefined
          }
        >
          ばらつき σ
          <input
            type="range"
            min={0.5}
            max={8}
            step={0.1}
            value={distribution.sigma}
            disabled={!presetUsesSigma(distribution.activePreset)}
            onChange={(e) => {
              const sigma = Number(e.target.value)
              if (presetUsesSigma(distribution.activePreset)) {
                rebuildPresetWeights({ sigma }, distribution.activePreset)
              }
            }}
          />
          <span className="dist-chart__sigma">
            {distribution.sigma.toFixed(1)}
          </span>
        </label>

        <label className="dist-chart__check">
          <input
            type="checkbox"
            checked={distribution.excludeOutOfKey}
            onChange={(e) => setExcludeOutOfKey(e.target.checked)}
          />
          キー外の音を 0%
        </label>
      </div>

      <div className="dist-chart__plot-wrap">
        <div
          className="dist-chart__bars"
          ref={chartRef}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          {pitches.map((midi, i) => {
            const inScale = isPitchInScale(midi, keyRoot, scale)
            const isCenter = i === distribution.halfRange
            const w = distribution.weights[i] ?? 0
            const h = Math.sqrt(w / maxW) * 100
            const pct = (probs[i] ?? 0) * 100
            return (
              <div
                key={`${midi}-${i}`}
                className={`dist-chart__col${isCenter ? ' is-center' : ''}`}
              >
                <span className="dist-chart__pct">
                  {pct >= 10 ? pct.toFixed(0) : pct.toFixed(1)}
                </span>
                <div className="dist-chart__track">
                  <button
                    type="button"
                    className={`dist-chart__bar${inScale ? ' is-in-scale' : ' is-out-of-scale'}${isCenter ? ' is-center-bar' : ''}`}
                    style={{ height: `${Math.max(h, w > 0 ? 1.5 : 0)}%` }}
                    title={`${pitchLabel(midi)}${isCenter ? '（中心）' : ''}: ${pct.toFixed(1)}%`}
                    aria-label={`${pitchLabel(midi)} の確率 ${pct.toFixed(1)}パーセント`}
                    onPointerDown={(e) => onPointerDown(i, e)}
                  />
                </div>
              </div>
            )
          })}
        </div>
        <div className="dist-chart__names">
          {pitches.map((midi, i) => {
            const inScale = isPitchInScale(midi, keyRoot, scale)
            const isCenter = i === distribution.halfRange
            return (
              <span
                key={`${midi}-${i}-name`}
                className={`dist-chart__label${inScale ? '' : ' is-out'}${isCenter ? ' is-center-label' : ''}`}
              >
                {pitchLabel(midi)}
              </span>
            )
          })}
        </div>
      </div>

      <p className="dist-chart__hint">
        「キー外の音を 0%」をオンにすると、プリセット適用時にキー内の音だけになります（カスタムの棒は変更しません）。
      </p>
    </div>
  )
}

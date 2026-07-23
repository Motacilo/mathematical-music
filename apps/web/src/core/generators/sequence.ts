import {
  evaluateExpr,
  looksLikeExpression,
  parseNumberList,
} from '../expr'
import { resolveRhythmSlots, countSoundingSlots } from '../rhythm'
import {
  buildSequencePitchRange,
  wrapToRangeIndex,
} from '../sequenceRange'
import type { Note, Phrase, ProjectSettings, SequenceParams } from '../types'

function uid(): string {
  return `ph_${Math.random().toString(36).slice(2, 10)}`
}

function valuesForSlots(
  params: SequenceParams,
  soundingCount: number,
): { values: number[]; error?: string } {
  const text = params.expression.trim() || 'n'
  if (looksLikeExpression(text) || /[nN]/.test(text)) {
    const values: number[] = []
    for (let n = 0; n < soundingCount; n++) {
      const r = evaluateExpr(text, n)
      if (!r.ok) {
        return { values: [], error: r.error }
      }
      values.push(r.value)
    }
    return { values }
  }
  const list = parseNumberList(text)
  if (list.length === 0) {
    // fallback: n
    return valuesForSlots({ ...params, expression: 'n' }, soundingCount)
  }
  const values: number[] = []
  for (let i = 0; i < soundingCount; i++) {
    values.push(list[i % list.length]!)
  }
  return { values }
}

export function generateSequencePhrase(
  settings: ProjectSettings,
  params: SequenceParams,
): Phrase {
  const slots = resolveRhythmSlots(settings.rhythmId, settings.restProbability)
  const pitches = buildSequencePitchRange(
    params.rangeLowMidi,
    params.rangeHighMidi,
    settings.keyRoot,
    settings.scale,
    params.chromaticSteps,
  )
  const soundingCount = countSoundingSlots(slots)
  const { values, error } = valuesForSlots(params, Math.max(1, soundingCount))

  // On error, fall back to ascending n through range
  const safeValues =
    error || values.length === 0
      ? Array.from({ length: Math.max(1, soundingCount) }, (_, n) => n)
      : values

  let vi = 0
  const notes: Note[] = slots.map((slot) => {
    if (slot.rest) {
      return { pitch: 0, duration: slot.duration, rest: true }
    }
    const raw = safeValues[vi] ?? vi
    vi++
    const index = wrapToRangeIndex(raw, pitches.length)
    return {
      pitch: pitches[index]!,
      duration: slot.duration,
    }
  })

  if (countSoundingSlots(slots) === 0) {
    notes.push({
      pitch: pitches[0]!,
      duration: '4n',
    })
  }

  return {
    id: uid(),
    notes,
    bars: 1,
    bpm: settings.bpm,
    keyRoot: settings.keyRoot,
    scale: settings.scale,
  }
}

export { parseNumberList }

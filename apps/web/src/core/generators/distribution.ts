import {
  getDistributionPitches,
  sampleFromWeights,
} from '../distributionWeights'
import { resolveRhythmSlots, countSoundingSlots } from '../rhythm'
import type { DistributionParams, Note, Phrase, ProjectSettings } from '../types'

function uid(): string {
  return `ph_${Math.random().toString(36).slice(2, 10)}`
}

export function generateDistributionPhrase(
  settings: ProjectSettings,
  params: DistributionParams,
): Phrase {
  const bars = Math.min(4, Math.max(1, settings.barCount || 1))
  const slots = resolveRhythmSlots(
    settings.rhythmId,
    settings.restProbability,
    bars,
  )
  const pitches = getDistributionPitches(params.centerMidi, params.halfRange)
  const notes: Note[] = []

  for (const slot of slots) {
    if (slot.rest) {
      notes.push({ pitch: 0, duration: slot.duration, rest: true })
      continue
    }
    const index = sampleFromWeights(params.weights)
    notes.push({
      pitch: pitches[index] ?? params.centerMidi,
      duration: slot.duration,
    })
  }

  if (countSoundingSlots(slots) === 0) {
    const index = sampleFromWeights(params.weights)
    notes.push({
      pitch: pitches[index] ?? params.centerMidi,
      duration: '4n',
    })
  }

  return {
    id: uid(),
    notes,
    bars,
    bpm: settings.bpm,
    keyRoot: settings.keyRoot,
    scale: settings.scale,
  }
}

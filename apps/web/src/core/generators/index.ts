import type {
  DistributionParams,
  GenMode,
  Phrase,
  ProjectSettings,
  SequenceParams,
} from '../types'
import { generateDistributionPhrase } from './distribution'
import { generateSequencePhrase } from './sequence'

export { parseNumberList } from './sequence'

/** 1〜2小節→最大8、3〜4小節→最大4（長い候補は件数を抑える） */
export function maxCandidateCount(barCount: number): number {
  return barCount >= 3 ? 4 : 8
}

export function generateCandidates(
  mode: GenMode,
  settings: ProjectSettings,
  distribution: DistributionParams,
  sequence: SequenceParams,
): Phrase[] {
  const max = maxCandidateCount(settings.barCount)
  const count = Math.min(max, Math.max(1, settings.candidateCount))
  const out: Phrase[] = []
  for (let i = 0; i < count; i++) {
    if (mode === 'distribution') {
      out.push(generateDistributionPhrase(settings, distribution))
    } else {
      out.push(generateSequencePhrase(settings, sequence))
    }
  }
  return out
}

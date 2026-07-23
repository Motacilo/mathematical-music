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

export function generateCandidates(
  mode: GenMode,
  settings: ProjectSettings,
  distribution: DistributionParams,
  sequence: SequenceParams,
): Phrase[] {
  const count = Math.min(8, Math.max(1, settings.candidateCount))
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

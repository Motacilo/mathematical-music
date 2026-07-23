import { isPitchInScale } from './distributionWeights'
import type { ScaleType } from './types'

/** Build ordered pitch list in [lowMidi, highMidi] (inclusive). */
export function buildSequencePitchRange(
  lowMidi: number,
  highMidi: number,
  keyRoot: number,
  scale: ScaleType,
  chromatic: boolean,
): number[] {
  const lo = Math.max(0, Math.min(lowMidi, highMidi))
  const hi = Math.min(127, Math.max(lowMidi, highMidi))
  const out: number[] = []
  for (let m = lo; m <= hi; m++) {
    if (chromatic || isPitchInScale(m, keyRoot, scale)) {
      out.push(m)
    }
  }
  if (out.length === 0) {
    out.push(lo)
  }
  return out
}

/** Map rounded value → index in range (0-based modulo wrap). */
export function wrapToRangeIndex(raw: number, length: number): number {
  if (length <= 0) return 0
  const k = Math.round(raw)
  return ((k % length) + length) % length
}

export function midiFromNoteOctave(pc: number, octave: number): number {
  return Math.max(0, Math.min(127, (octave + 1) * 12 + (((pc % 12) + 12) % 12)))
}

export function noteOctaveFromMidi(midi: number): { pc: number; octave: number } {
  const pc = ((midi % 12) + 12) % 12
  const octave = Math.floor(midi / 12) - 1
  return { pc, octave }
}

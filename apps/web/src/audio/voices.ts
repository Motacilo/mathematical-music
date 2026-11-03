import * as Tone from 'tone'
import type { ToneId } from '../core/tones/presets'

type Engine = 'synth' | 'fm'

interface VoiceDef {
  engine: Engine
  options: Record<string, unknown>
  /** Output trim. Bass sine needs a boost to stay audible. */
  volumeDb: number
}

const LEAD: Record<ToneId, VoiceDef> = {
  piano: {
    engine: 'fm',
    volumeDb: -3,
    options: {
      harmonicity: 2,
      modulationIndex: 1.15,
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.004, decay: 0.42, sustain: 0.1, release: 0.45 },
      modulation: { type: 'sine' },
      modulationEnvelope: {
        attack: 0.004,
        decay: 0.18,
        sustain: 0.04,
        release: 0.25,
      },
    },
  },
  soft: {
    engine: 'synth',
    volumeDb: -2,
    options: {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.09, decay: 0.22, sustain: 0.72, release: 0.65 },
    },
  },
  guitar: {
    engine: 'fm',
    volumeDb: -6,
    options: {
      harmonicity: 3,
      modulationIndex: 2.1,
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.002, decay: 0.26, sustain: 0.02, release: 0.16 },
      modulation: { type: 'square' },
      modulationEnvelope: {
        attack: 0.001,
        decay: 0.1,
        sustain: 0,
        release: 0.06,
      },
    },
  },
}

const BASS: Record<ToneId, VoiceDef> = {
  piano: {
    engine: 'synth',
    volumeDb: 5,
    options: {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.008, decay: 0.16, sustain: 0.55, release: 0.12 },
    },
  },
  soft: {
    engine: 'synth',
    volumeDb: 8,
    options: {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.03, decay: 0.08, sustain: 0.9, release: 0.2 },
    },
  },
  guitar: {
    engine: 'fm',
    volumeDb: 1,
    options: {
      harmonicity: 1.5,
      modulationIndex: 2.4,
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.002, decay: 0.2, sustain: 0.12, release: 0.1 },
      modulation: { type: 'square' },
      modulationEnvelope: {
        attack: 0.001,
        decay: 0.08,
        sustain: 0,
        release: 0.05,
      },
    },
  },
}

export type LeadSynth = Tone.Synth | Tone.FMSynth

function makeVoice(def: VoiceDef): LeadSynth {
  const synth =
    def.engine === 'fm'
      ? new Tone.FMSynth(def.options as unknown as Tone.FMSynthOptions)
      : new Tone.Synth(def.options as unknown as Tone.SynthOptions)
  synth.volume.value = def.volumeDb
  return synth
}

export function createLead(id: ToneId): LeadSynth {
  return makeVoice(LEAD[id])
}

export function createBass(id: ToneId): LeadSynth {
  return makeVoice(BASS[id])
}

export function createPoly(id: ToneId): Tone.PolySynth {
  const def = LEAD[id]
  const poly =
    def.engine === 'fm'
      ? new Tone.PolySynth({
          voice: Tone.FMSynth,
          maxPolyphony: 8,
          options: def.options as unknown as Tone.FMSynthOptions,
        })
      : new Tone.PolySynth({
          voice: Tone.Synth,
          maxPolyphony: 8,
          options: def.options as unknown as Tone.SynthOptions,
        })
  poly.volume.value = def.volumeDb
  return poly
}

export function createChordVoices(id: ToneId, count: number): LeadSynth[] {
  return Array.from({ length: count }, () => createLead(id))
}

import * as Tone from 'tone'
import type { ToneId } from '../core/tones/presets'

type Engine = 'synth' | 'fm'

interface VoiceDef {
  engine: Engine
  options: Record<string, unknown>
  /** Output trim. */
  volumeDb: number
}

/**
 * Melody and chords share the lead timbres but sit at different levels.
 * Levels are set by measurement (K-weighted loudness, default mixer) so every
 * tone lands at about the same place in the mix: melody ~4 LU above the
 * drums, chords and bass a little under the drums. Plucky FM tones are capped
 * so their attack peak stays under full scale, which leaves guitar chords a
 * little quieter on average.
 */
const LEAD_LEVEL_DB: Record<ToneId, { melody: number; chords: number }> = {
  piano: { melody: 8, chords: 8 },
  soft: { melody: -10, chords: -13.5 },
  guitar: { melody: 10.5, chords: 5.5 },
  musicbox: { melody: 4.7, chords: 4.7 },
  glock: { melody: 5.5, chords: 5.5 },
  xylo: { melody: 9.3, chords: 9.6 },
}

export type LeadPart = 'melody' | 'chords'

const LEAD: Record<ToneId, Omit<VoiceDef, 'volumeDb'>> = {
  piano: {
    engine: 'fm',
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
    options: {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.09, decay: 0.22, sustain: 0.72, release: 0.65 },
    },
  },
  guitar: {
    engine: 'fm',
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
  // Struck-bar tones: a pure carrier with a short, bright FM "ping" on the attack.
  musicbox: {
    engine: 'fm',
    options: {
      harmonicity: 3,
      modulationIndex: 0.9,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.002, decay: 0.9, sustain: 0, release: 0.6 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.1 },
    },
  },
  glock: {
    engine: 'fm',
    options: {
      harmonicity: 5.2,
      modulationIndex: 3,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.7, sustain: 0, release: 0.5 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.2 },
    },
  },
  xylo: {
    engine: 'fm',
    options: {
      harmonicity: 3,
      modulationIndex: 1.6,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.1 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.05 },
    },
  },
}

const BASS: Record<ToneId, VoiceDef> = {
  piano: {
    engine: 'synth',
    // Triangle carries audible upper harmonics; -9 dB puts it just under the drums.
    volumeDb: -9,
    options: {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.008, decay: 0.16, sustain: 0.55, release: 0.12 },
    },
  },
  soft: {
    engine: 'synth',
    // A full-level sine bass was ~20 LU above everything else (and clipping).
    volumeDb: -14,
    options: {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.03, decay: 0.08, sustain: 0.9, release: 0.2 },
    },
  },
  guitar: {
    engine: 'fm',
    volumeDb: 6.5,
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
  musicbox: {
    engine: 'fm',
    volumeDb: 2.2,
    options: {
      harmonicity: 2,
      modulationIndex: 0.8,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.002, decay: 0.7, sustain: 0.05, release: 0.3 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.08 },
    },
  },
  glock: {
    engine: 'fm',
    volumeDb: 3.7,
    options: {
      harmonicity: 3.5,
      modulationIndex: 2,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.3 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 },
    },
  },
  xylo: {
    engine: 'fm',
    volumeDb: 5.0,
    options: {
      harmonicity: 4,
      modulationIndex: 1.2,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.1 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 },
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

function leadDef(id: ToneId, part: LeadPart): VoiceDef {
  return { ...LEAD[id], volumeDb: LEAD_LEVEL_DB[id][part] }
}

/** Single melody voice (WAV export). */
export function createLead(id: ToneId, part: LeadPart = 'melody'): LeadSynth {
  return makeVoice(leadDef(id, part))
}

export function createBass(id: ToneId): LeadSynth {
  return makeVoice(BASS[id])
}

export function createPoly(id: ToneId, part: LeadPart): Tone.PolySynth {
  const def = leadDef(id, part)
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
  return Array.from({ length: count }, () => createLead(id, 'chords'))
}

/** Overall trim after the parts are balanced, so the full mix stays near its old loudness. */
export const MASTER_TRIM_DB = -5

/**
 * Master bus for one audio context: trim, then a limiter to catch the moments
 * when several attacks line up. Connect every part to the returned node.
 */
export function createMasterBus(): Tone.Gain {
  const limiter = new Tone.Limiter(-1).toDestination()
  return new Tone.Gain(Tone.dbToGain(MASTER_TRIM_DB)).connect(limiter)
}

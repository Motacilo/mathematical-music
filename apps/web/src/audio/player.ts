import * as Tone from 'tone'
import { DURATION_BEATS } from '../core/rhythm'
import type { Phrase } from '../core/types'

let synth: Tone.Synth | null = null
let endTimer: ReturnType<typeof setTimeout> | null = null
let playing = false

function getSynth(): Tone.Synth {
  if (!synth) {
    synth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.2 },
    }).toDestination()
  }
  return synth
}

export async function ensureAudio(): Promise<void> {
  await Tone.start()
  getSynth()
}

export function isPlaying(): boolean {
  return playing
}

export async function stopPlayback(): Promise<void> {
  if (endTimer != null) {
    clearTimeout(endTimer)
    endTimer = null
  }
  if (synth) {
    synth.triggerRelease()
  }
  playing = false
}

export async function playPhrases(
  phrases: Phrase[],
  bpm: number,
  onEnd?: () => void,
): Promise<void> {
  await ensureAudio()
  await stopPlayback()

  const s = getSynth()
  const beatSec = 60 / bpm
  let t = Tone.now() + 0.05
  const start = t

  for (const phrase of phrases) {
    for (const note of phrase.notes) {
      const durSec = DURATION_BEATS[note.duration] * beatSec
      if (!note.rest) {
        const freq = Tone.Frequency(note.pitch, 'midi').toFrequency()
        s.triggerAttackRelease(freq, Math.max(0.05, durSec * 0.9), t)
      }
      t += durSec
    }
  }

  playing = true
  const totalMs = (t - start + 0.2) * 1000
  endTimer = setTimeout(() => {
    playing = false
    endTimer = null
    onEnd?.()
  }, totalMs)
}

export async function playPhrase(
  phrase: Phrase,
  bpm: number,
  onEnd?: () => void,
): Promise<void> {
  await playPhrases([phrase], bpm, onEnd)
}

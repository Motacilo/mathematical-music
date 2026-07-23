import * as Tone from 'tone'
import { DURATION_BEATS } from '../core/rhythm'
import type { Phrase } from '../core/types'

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const bitDepth = 16
  const samples = buffer.length
  const blockAlign = (numChannels * bitDepth) / 8
  const byteRate = sampleRate * blockAlign
  const dataSize = samples * blockAlign
  const arrayBuffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(arrayBuffer)

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)

  const channels: Float32Array[] = []
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c))
  }

  let offset = 44
  for (let i = 0; i < samples; i++) {
    for (let c = 0; c < numChannels; c++) {
      let sample = Math.max(-1, Math.min(1, channels[c]![i]!))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' })
}

function totalDurationSec(phrases: Phrase[], bpm: number): number {
  const beatSec = 60 / bpm
  let beats = 0
  for (const phrase of phrases) {
    for (const note of phrase.notes) {
      beats += DURATION_BEATS[note.duration]
    }
  }
  return Math.max(0.5, beats * beatSec + 0.35)
}

export async function renderWavBlob(
  phrases: Phrase[],
  bpm: number,
): Promise<Blob> {
  const duration = totalDurationSec(phrases, bpm)
  const rendered = await Tone.Offline(() => {
    const synth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.25 },
    }).toDestination()

    const beatSec = 60 / bpm
    let t = 0
    for (const phrase of phrases) {
      for (const note of phrase.notes) {
        const durSec = DURATION_BEATS[note.duration] * beatSec
        if (!note.rest) {
          const freq = Tone.Frequency(note.pitch, 'midi').toFrequency()
          synth.triggerAttackRelease(freq, Math.max(0.05, durSec * 0.9), t)
        }
        t += durSec
      }
    }
  }, duration)

  const audioBuffer =
    typeof (rendered as { get?: () => AudioBuffer }).get === 'function'
      ? (rendered as { get: () => AudioBuffer }).get()
      : (rendered as unknown as AudioBuffer)

  return audioBufferToWav(audioBuffer)
}

export async function downloadWav(
  phrases: Phrase[],
  bpm: number,
  filename = 'melody.wav',
): Promise<void> {
  const blob = await renderWavBlob(phrases, bpm)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

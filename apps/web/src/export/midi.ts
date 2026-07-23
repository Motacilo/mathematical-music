import { Midi } from '@tonejs/midi'
import { DURATION_BEATS } from '../core/rhythm'
import type { Phrase } from '../core/types'

export function buildMidiBlob(phrases: Phrase[], bpm: number): Blob {
  const midi = new Midi()
  midi.header.setTempo(bpm)
  midi.header.timeSignatures.push({
    ticks: 0,
    timeSignature: [4, 4],
    measures: 0,
  })

  const track = midi.addTrack()
  track.name = 'Melody'
  track.channel = 0

  const ppq = midi.header.ppq
  let tick = 0

  for (const phrase of phrases) {
    for (const note of phrase.notes) {
      const durationTicks = Math.round(DURATION_BEATS[note.duration] * ppq)
      if (!note.rest) {
        track.addNote({
          midi: note.pitch,
          ticks: tick,
          durationTicks,
          velocity: 0.8,
        })
      }
      tick += durationTicks
    }
  }

  const bytes = new Uint8Array(midi.toArray())
  return new Blob([bytes], { type: 'audio/midi' })
}

export function downloadMidi(phrases: Phrase[], bpm: number, filename = 'melody.mid'): void {
  const blob = buildMidiBlob(phrases, bpm)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

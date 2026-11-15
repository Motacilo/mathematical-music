import { Midi } from '@tonejs/midi'
import { DURATION_BEATS } from '../core/rhythm'
import { expandChordBarPlay, styleForBar } from '../core/chords/playStyle'
import { drumInstrumentMidi } from '../core/drums/generate'
import type { ChordBar, ChordPlayStyleId, DrumPhrase } from '../core/projectTypes'
import type { Phrase } from '../core/types'
import {
  createDefaultTones,
  gmProgram,
  type ToneId,
  type ToneMap,
} from '../core/tones/presets'

export type MidiLayers = {
  melody?: Phrase[]
  chords?: ChordBar[]
  bass?: Phrase[]
  drums?: DrumPhrase[]
}

function addPhraseTrack(
  midi: Midi,
  name: string,
  channel: number,
  phrases: Phrase[],
  program: number,
): void {
  if (!phrases.length) return
  const track = midi.addTrack()
  track.name = name
  track.channel = channel
  track.instrument.number = program
  const ppq = midi.header.ppq
  let tick = 0
  let lastBpm = phrases[0]?.bpm ?? 120

  for (const phrase of phrases) {
    if (phrase.bpm !== lastBpm) {
      midi.header.tempos.push({ ticks: tick, bpm: phrase.bpm })
      lastBpm = phrase.bpm
    }
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
}

/** Chords are written the way they are played (arpeggio, pulse, ...), so Cubase gets the same part. */
function addChordTrack(
  midi: Midi,
  chords: ChordBar[],
  program: number,
  playStyle: ChordPlayStyleId,
): void {
  if (!chords.length) return
  const track = midi.addTrack()
  track.name = 'Chords'
  track.channel = 1
  track.instrument.number = program
  const ppq = midi.header.ppq
  let tick = 0
  for (const bar of chords) {
    for (const ev of expandChordBarPlay(bar, styleForBar(bar, playStyle))) {
      for (const p of ev.pitches) {
        track.addNote({
          midi: p,
          ticks: tick + Math.round(ev.timeBeat * ppq),
          durationTicks: Math.max(1, Math.round(ev.durationBeats * ppq)),
          velocity: 0.7,
        })
      }
    }
    tick += ppq * 4
  }
}

function addDrumTrack(midi: Midi, phrases: DrumPhrase[]): void {
  if (!phrases.length) return
  const track = midi.addTrack()
  track.name = 'Drums'
  track.channel = 9
  const ppq = midi.header.ppq
  let barTick = 0
  for (const phrase of phrases) {
    for (const hit of phrase.hits) {
      const ticks = barTick + Math.round(hit.beat * ppq)
      const durationTicks = Math.round(DURATION_BEATS[hit.duration] * ppq)
      track.addNote({
        midi: drumInstrumentMidi(hit.instrument),
        ticks,
        durationTicks,
        velocity: hit.instrument === 'hat' ? 0.55 : 0.85,
      })
    }
    barTick += phrase.bars * 4 * ppq
  }
}

export function buildMultiTrackMidiBlob(
  layers: MidiLayers,
  tones: ToneMap = createDefaultTones(),
  chordPlayStyle: ChordPlayStyleId = 'block',
): Blob {
  const midi = new Midi()
  const bpm =
    layers.melody?.[0]?.bpm ??
    layers.chords?.[0]?.bpm ??
    layers.bass?.[0]?.bpm ??
    layers.drums?.[0]?.bpm ??
    120
  midi.header.setTempo(bpm)
  midi.header.timeSignatures.push({
    ticks: 0,
    timeSignature: [4, 4],
    measures: 0,
  })

  if (layers.melody?.length) {
    addPhraseTrack(midi, 'Melody', 0, layers.melody, gmProgram('melody', tones.melody))
  }
  if (layers.chords?.length) {
    addChordTrack(midi, layers.chords, gmProgram('chords', tones.chords), chordPlayStyle)
  }
  if (layers.bass?.length) {
    addPhraseTrack(midi, 'Bass', 2, layers.bass, gmProgram('bass', tones.bass))
  }
  if (layers.drums?.length) addDrumTrack(midi, layers.drums)

  const bytes = new Uint8Array(midi.toArray())
  return new Blob([bytes], { type: 'audio/midi' })
}

export function buildMidiBlob(phrases: Phrase[], tone: ToneId = 'piano'): Blob {
  return buildMultiTrackMidiBlob(
    { melody: phrases },
    { ...createDefaultTones(), melody: tone },
  )
}

export function downloadMidi(
  phrases: Phrase[],
  filename = 'melody.mid',
  tone: ToneId = 'piano',
): void {
  const blob = buildMidiBlob(phrases, tone)
  triggerDownload(blob, filename)
}

export function downloadMultiTrackMidi(
  layers: MidiLayers,
  filename = 'arrangement.mid',
  tones: ToneMap = createDefaultTones(),
  chordPlayStyle: ChordPlayStyleId = 'block',
): void {
  triggerDownload(buildMultiTrackMidiBlob(layers, tones, chordPlayStyle), filename)
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

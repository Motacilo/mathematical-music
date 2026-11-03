import { uid } from '../chords/theory'
import { splitPhraseIntoBars } from '../phraseSplit'
import type { ChordBar, DrumPhrase } from '../projectTypes'
import type { ProjectDraft } from '../projectStore'
import type { Phrase } from '../types'
import type { SectionCandidate } from './generate'
import { sectionRoleLabel, type SongSection } from './roles'

function phraseBarCount(phrases: readonly { bars?: number }[]): number {
  return phrases.reduce((sum, p) => sum + Math.max(1, p.bars || 1), 0)
}

export function contentBarCount(draft: ProjectDraft): number {
  return Math.max(
    phraseBarCount(draft.melody.stage),
    draft.chords.stage.length,
    phraseBarCount(draft.bass.stage),
    phraseBarCount(draft.drums.stage),
  )
}

export function appendCursor(draft: ProjectDraft): number {
  if (draft.sections.length === 0) return contentBarCount(draft)
  const last = draft.sections[draft.sections.length - 1]!
  return last.startBar + last.bars
}

/** Start time of each bar, plus one extra entry for the end. Seconds. */
export function barTimeEdges(
  phrases: readonly { bars?: number; bpm?: number }[],
  fallbackBpm: number,
): number[] {
  const edges = [0]
  let t = 0
  for (const phrase of phrases) {
    const bars = Math.max(1, phrase.bars || 1)
    const bpm = phrase.bpm && phrase.bpm > 0 ? phrase.bpm : fallbackBpm
    const barSec = 240 / bpm
    for (let i = 0; i < bars; i++) {
      t += barSec
      edges.push(t)
    }
  }
  return edges
}

export function longestBarEdges(draft: ProjectDraft): number[] {
  const bpm = draft.meta.bpm
  const chords = draft.chords.stage.map((bar) => ({ bars: 1, bpm: bar.bpm }))
  const options = [
    barTimeEdges(draft.melody.stage, bpm),
    barTimeEdges(draft.bass.stage, bpm),
    barTimeEdges(draft.drums.stage, bpm),
    barTimeEdges(chords, bpm),
  ]
  return options.reduce((best, next) => (next.length > best.length ? next : best))
}

/** Section sounding at elapsed seconds, or null during a gap or after the end. */
export function sectionIdAtElapsed(
  sections: readonly SongSection[],
  edges: readonly number[],
  elapsedSec: number,
): string | null {
  if (edges.length < 2 || elapsedSec < 0) return null
  const end = edges[edges.length - 1]!
  if (elapsedSec >= end) return null
  let bar = 0
  for (let i = 0; i < edges.length - 1; i++) {
    if (elapsedSec < edges[i + 1]!) {
      bar = i
      break
    }
  }
  const found = sections.find(
    (section) => bar >= section.startBar && bar < section.startBar + section.bars,
  )
  return found?.id ?? null
}

export function sectionLabelAt(
  sections: readonly SongSection[],
  barIndex: number,
): string | null {
  const found = sections.find(
    (s) => barIndex >= s.startBar && barIndex < s.startBar + s.bars,
  )
  return found ? sectionRoleLabel(found.role) : null
}

export function labelsForPhrases(
  sections: readonly SongSection[],
  phrases: readonly { bars?: number }[],
): (string | null)[] {
  let bar = 0
  return phrases.map((phrase) => {
    const label = sectionLabelAt(sections, bar)
    bar += Math.max(1, phrase.bars || 1)
    return label
  })
}

function restPhrase(proto: {
  bpm: number
  keyRoot: number
  scale: Phrase['scale']
}): Phrase {
  return {
    id: uid('bar'),
    bars: 1,
    bpm: proto.bpm,
    keyRoot: proto.keyRoot,
    scale: proto.scale,
    notes: [
      { pitch: 36, duration: '4n', rest: true },
      { pitch: 36, duration: '4n', rest: true },
      { pitch: 36, duration: '4n', rest: true },
      { pitch: 36, duration: '4n', rest: true },
    ],
  }
}

function splitDrumByBar(phrase: DrumPhrase): DrumPhrase[] {
  const n = Math.max(1, phrase.bars)
  const out: DrumPhrase[] = []
  for (let b = 0; b < n; b++) {
    out.push({
      ...phrase,
      id: uid('drm'),
      bars: 1,
      hits: phrase.hits
        .filter((h) => h.beat >= b * 4 - 1e-6 && h.beat < (b + 1) * 4 - 1e-6)
        .map((h) => ({ ...h, beat: h.beat - b * 4 })),
    })
  }
  return out
}

function splitPhrasesAt(
  phrases: Phrase[],
  start: number,
  count: number,
): { before: Phrase[]; after: Phrase[] } {
  const end = start + count
  const before: Phrase[] = []
  const after: Phrase[] = []
  let cursor = 0
  for (const phrase of phrases) {
    const parts = splitPhraseIntoBars(phrase)
    const phraseStart = cursor
    cursor += parts.length
    if (cursor <= start) {
      before.push(phrase)
      continue
    }
    if (phraseStart >= end) {
      after.push(phrase)
      continue
    }
    parts.forEach((part, i) => {
      const bar = phraseStart + i
      if (bar < start) before.push(part)
      else if (bar >= end) after.push(part)
    })
  }
  return { before, after }
}

function splitDrumsAt(
  phrases: DrumPhrase[],
  start: number,
  count: number,
): { before: DrumPhrase[]; after: DrumPhrase[] } {
  const end = start + count
  const before: DrumPhrase[] = []
  const after: DrumPhrase[] = []
  let cursor = 0
  for (const phrase of phrases) {
    const parts = splitDrumByBar(phrase)
    const phraseStart = cursor
    cursor += parts.length
    if (cursor <= start) {
      before.push(phrase)
      continue
    }
    if (phraseStart >= end) {
      after.push(phrase)
      continue
    }
    parts.forEach((part, i) => {
      const bar = phraseStart + i
      if (bar < start) before.push(part)
      else if (bar >= end) after.push(part)
    })
  }
  return { before, after }
}

function padPhrases(phrases: Phrase[], length: number, proto: Phrase): Phrase[] {
  const out = [...phrases]
  while (phraseBarCount(out) < length) out.push(restPhrase(proto))
  return out
}

function padDrums(phrases: DrumPhrase[], length: number, bpm: number): DrumPhrase[] {
  const out = [...phrases]
  while (phraseBarCount(out) < length) {
    out.push({ id: uid('drm'), bars: 1, bpm, hits: [] })
  }
  return out
}

function padChords(chords: ChordBar[], length: number, fill: ChordBar): ChordBar[] {
  const out = [...chords]
  const seed = out[out.length - 1] ?? fill
  while (out.length < length) out.push({ ...seed, id: uid('ch') })
  return out
}

function insertPhrases(phrases: Phrase[], start: number, block: Phrase[]): Phrase[] {
  const proto = block[0]
  const padded = proto ? padPhrases(phrases, start, proto) : phrases
  const { before, after } = splitPhrasesAt(padded, start, 0)
  return [...before, ...block, ...after]
}

function insertDrums(
  phrases: DrumPhrase[],
  start: number,
  block: DrumPhrase[],
): DrumPhrase[] {
  const bpm = block[0]?.bpm ?? phrases[0]?.bpm ?? 120
  const padded = padDrums(phrases, start, bpm)
  const { before, after } = splitDrumsAt(padded, start, 0)
  return [...before, ...block, ...after]
}

function insertChords(
  chords: ChordBar[],
  start: number,
  block: ChordBar[],
): ChordBar[] {
  const fill = block[0]
  const padded = fill ? padChords(chords, start, fill) : chords
  return [...padded.slice(0, start), ...block, ...padded.slice(start)]
}

function shiftAfter(sections: SongSection[], start: number, delta: number): SongSection[] {
  if (delta === 0) return sections
  return sections.map((s) =>
    s.startBar >= start ? { ...s, startBar: s.startBar + delta } : s,
  )
}

export function appendSection(
  draft: ProjectDraft,
  block: SectionCandidate,
): ProjectDraft {
  const startBar = appendCursor(draft)
  const section: SongSection = {
    id: uid('sec'),
    role: block.role,
    bars: block.bars,
    startBar,
  }
  return {
    ...draft,
    sections: [...draft.sections, section],
    melody: {
      ...draft.melody,
      stage: insertPhrases(draft.melody.stage, startBar, block.melody),
    },
    chords: {
      ...draft.chords,
      stage: insertChords(draft.chords.stage, startBar, block.chords),
    },
    bass: {
      ...draft.bass,
      stage: insertPhrases(draft.bass.stage, startBar, block.bass),
    },
    drums: {
      ...draft.drums,
      stage: insertDrums(draft.drums.stage, startBar, block.drums),
    },
  }
}

export function removeSection(draft: ProjectDraft, sectionId: string): ProjectDraft {
  const section = draft.sections.find((s) => s.id === sectionId)
  if (!section) return draft
  const { before: melB, after: melA } = splitPhrasesAt(
    draft.melody.stage,
    section.startBar,
    section.bars,
  )
  const { before: bassB, after: bassA } = splitPhrasesAt(
    draft.bass.stage,
    section.startBar,
    section.bars,
  )
  const { before: drmB, after: drmA } = splitDrumsAt(
    draft.drums.stage,
    section.startBar,
    section.bars,
  )
  return {
    ...draft,
    sections: shiftAfter(
      draft.sections.filter((s) => s.id !== sectionId),
      section.startBar + section.bars,
      -section.bars,
    ),
    melody: { ...draft.melody, stage: [...melB, ...melA] },
    chords: {
      ...draft.chords,
      stage: [
        ...draft.chords.stage.slice(0, section.startBar),
        ...draft.chords.stage.slice(section.startBar + section.bars),
      ],
    },
    bass: { ...draft.bass, stage: [...bassB, ...bassA] },
    drums: { ...draft.drums, stage: [...drmB, ...drmA] },
  }
}

export function replaceSection(
  draft: ProjectDraft,
  sectionId: string,
  block: SectionCandidate,
): ProjectDraft {
  const section = draft.sections.find((s) => s.id === sectionId)
  if (!section) return appendSection(draft, block)
  const cleared = removeSection(draft, sectionId)
  const startBar = section.startBar
  return {
    ...cleared,
    sections: [
      ...shiftAfter(cleared.sections, startBar, block.bars),
      {
        id: uid('sec'),
        role: block.role,
        bars: block.bars,
        startBar,
      },
    ].sort((a, b) => a.startBar - b.startBar),
    melody: {
      ...cleared.melody,
      stage: insertPhrases(cleared.melody.stage, startBar, block.melody),
    },
    chords: {
      ...cleared.chords,
      stage: insertChords(cleared.chords.stage, startBar, block.chords),
    },
    bass: {
      ...cleared.bass,
      stage: insertPhrases(cleared.bass.stage, startBar, block.bass),
    },
    drums: {
      ...cleared.drums,
      stage: insertDrums(cleared.drums.stage, startBar, block.drums),
    },
  }
}

export function slicePhrases(phrases: Phrase[], start: number, bars: number): Phrase[] {
  const end = start + bars
  const out: Phrase[] = []
  let cursor = 0
  for (const phrase of phrases) {
    const parts = splitPhraseIntoBars(phrase)
    const phraseStart = cursor
    cursor += parts.length
    if (cursor <= start || phraseStart >= end) continue
    parts.forEach((part, i) => {
      const bar = phraseStart + i
      if (bar >= start && bar < end) out.push(part)
    })
  }
  return out
}

export function sliceDrums(
  phrases: DrumPhrase[],
  start: number,
  bars: number,
): DrumPhrase[] {
  const end = start + bars
  const out: DrumPhrase[] = []
  let cursor = 0
  for (const phrase of phrases) {
    const parts = splitDrumByBar(phrase)
    const phraseStart = cursor
    cursor += parts.length
    if (cursor <= start || phraseStart >= end) continue
    parts.forEach((part, i) => {
      const bar = phraseStart + i
      if (bar >= start && bar < end) out.push(part)
    })
  }
  return out
}

export function sliceChords(chords: ChordBar[], start: number, bars: number): ChordBar[] {
  return chords.slice(start, start + bars)
}

export function replaceWithSections(
  draft: ProjectDraft,
  blocks: readonly SectionCandidate[],
): ProjectDraft {
  return blocks.reduce(appendSection, clearSong(draft))
}

export function clearSong(draft: ProjectDraft): ProjectDraft {
  return {
    ...draft,
    sections: [],
    melody: { ...draft.melody, stage: [] },
    chords: { ...draft.chords, stage: [] },
    bass: { ...draft.bass, stage: [] },
    drums: { ...draft.drums, stage: [] },
  }
}

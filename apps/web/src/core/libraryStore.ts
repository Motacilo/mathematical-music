import { storageGet, storageRemove, storageSet } from './safeStorage'
import {
  patchComposerStage,
  readStageFromDraft,
} from './composerDraft'
import type { Phrase } from './types'

const FAVORITES_KEY = 'mm-favorites-v1'
const SCORES_KEY = 'mm-scores-v1'
const PENDING_APPEND_KEY = 'mm-pending-append-v1'

export interface FavoriteEntry {
  id: string
  savedAt: number
  phrase: Phrase
}

export interface ScoreEntry {
  id: string
  savedAt: number
  name: string
  phrases: Phrase[]
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = storageGet('local', key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): boolean {
  return storageSet('local', key, JSON.stringify(value))
}

export function listFavorites(): FavoriteEntry[] {
  return readJson<FavoriteEntry[]>(FAVORITES_KEY, []).sort(
    (a, b) => b.savedAt - a.savedAt,
  )
}

export function addFavorite(phrase: Phrase): FavoriteEntry {
  const entry: FavoriteEntry = {
    id: uid('fav'),
    savedAt: Date.now(),
    phrase: {
      ...phrase,
      id: uid('ph'),
      notes: phrase.notes.map((n) => ({ ...n })),
    },
  }
  const next = [entry, ...listFavorites()].slice(0, 50)
  writeJson(FAVORITES_KEY, next)
  return entry
}

export function removeFavorite(id: string): void {
  writeJson(
    FAVORITES_KEY,
    listFavorites().filter((f) => f.id !== id),
  )
}

export function listScores(): ScoreEntry[] {
  return readJson<ScoreEntry[]>(SCORES_KEY, []).sort(
    (a, b) => b.savedAt - a.savedAt,
  )
}

export function addScore(name: string, phrases: Phrase[]): ScoreEntry {
  const entry: ScoreEntry = {
    id: uid('score'),
    savedAt: Date.now(),
    name: name.trim() || defaultScoreName(),
    phrases: phrases.map((p) => ({
      ...p,
      id: uid('ph'),
      notes: p.notes.map((n) => ({ ...n })),
    })),
  }
  const next = [entry, ...listScores()].slice(0, 30)
  writeJson(SCORES_KEY, next)
  return entry
}

export function removeScore(id: string): void {
  writeJson(
    SCORES_KEY,
    listScores().filter((s) => s.id !== id),
  )
}

export function defaultScoreName(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `譜面 ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function clonePhrase(phrase: Phrase): Phrase {
  return {
    ...phrase,
    id: uid('ph'),
    notes: phrase.notes.map((n) => ({ ...n })),
  }
}

export function clonePhrases(phrases: Phrase[]): Phrase[] {
  return phrases.map(clonePhrase)
}

export function formatSavedAt(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Keep current score while navigating / reloading (via composer draft). */
export function readStageDraft(): Phrase[] {
  return readStageFromDraft()
}

export function writeStageDraft(phrases: Phrase[]): void {
  patchComposerStage(phrases)
}

/**
 * Queue phrases to append once after returning to the composer.
 * Consumed with takePendingAppend (StrictMode-safe).
 */
export function setPendingAppend(phrases: Phrase[]): void {
  storageSet(
    'session',
    PENDING_APPEND_KEY,
    JSON.stringify(clonePhrases(phrases)),
  )
}

export function takePendingAppend(): Phrase[] | null {
  const raw = storageGet('session', PENDING_APPEND_KEY)
  if (!raw) return null
  storageRemove('session', PENDING_APPEND_KEY)
  try {
    const parsed = JSON.parse(raw) as Phrase[]
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

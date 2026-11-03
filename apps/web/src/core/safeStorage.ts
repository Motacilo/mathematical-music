/**
 * Web Storage wrappers that never throw.
 *
 * localStorage / sessionStorage can throw when the quota is exceeded, when
 * storage is disabled (some private-browsing modes, blocked site data), or
 * when the property access itself is denied. A failed save must not break
 * the editor, so failures are logged and the user is told once per session.
 */

type StorageKind = 'local' | 'session'

let warned = false

function getStorage(kind: StorageKind): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

function warnOnce(err: unknown): void {
  console.warn('[storage] write failed', err)
  if (warned) return
  warned = true
  try {
    window.alert(
      'このブラウザに保存できませんでした。保存領域がいっぱいか、保存が無効になっている可能性があります。\n' +
        '作業はこのまま続けられますが、ページを閉じると内容が消えることがあります。\n' +
        '残したい曲は「出力」から MIDI / WAV で保存してください。',
    )
  } catch {
    /* ignore */
  }
}

export function storageGet(kind: StorageKind, key: string): string | null {
  try {
    return getStorage(kind)?.getItem(key) ?? null
  } catch {
    return null
  }
}

/** Returns false when the value could not be saved. */
export function storageSet(kind: StorageKind, key: string, value: string): boolean {
  const storage = getStorage(kind)
  if (!storage) {
    warnOnce(new Error(`${kind}Storage unavailable`))
    return false
  }
  try {
    storage.setItem(key, value)
    return true
  } catch (err) {
    warnOnce(err)
    return false
  }
}

export function storageRemove(kind: StorageKind, key: string): void {
  try {
    getStorage(kind)?.removeItem(key)
  } catch {
    /* ignore */
  }
}

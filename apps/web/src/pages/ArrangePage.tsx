import { useMemo, useState } from 'react'
import { playLayers, stopPlayback } from '../audio/player'
import { downloadMultiTrackMidi } from '../export/midi'
import { downloadMixWav, filterLayersByInclude } from '../export/wav'
import { collectKeyWarnings, useProject } from '../core/ProjectContext'
import { LAYER_LABELS, type LayerKind } from '../core/projectTypes'
import { keyOptionLabel } from '../core/scale'
import '../pages/ComposerPage.css'
import './LayerPages.css'

const LAYERS: LayerKind[] = ['melody', 'chords', 'bass', 'drums']

export default function ArrangePage() {
  const { draft, setMixer, setLayerInclude } = useProject()
  const [playing, setPlaying] = useState(false)
  const [exporting, setExporting] = useState(false)
  const warnings = collectKeyWarnings(draft)

  const allLayers = useMemo(
    () => ({
      melody: draft.melody.stage,
      chords: draft.chords.stage,
      bass: draft.bass.stage,
      drums: draft.drums.stage,
    }),
    [draft.melody.stage, draft.chords.stage, draft.bass.stage, draft.drums.stage],
  )

  const selectedLayers = useMemo(
    () => filterLayersByInclude(allLayers, draft.layerInclude),
    [allLayers, draft.layerInclude],
  )

  const selectedCount = LAYERS.filter((k) => {
    if (!draft.layerInclude[k]) return false
    const data = allLayers[k]
    return Array.isArray(data) && data.length > 0
  }).length

  const playSelected = async () => {
    if (selectedCount === 0) {
      window.alert('チェックしたレイヤにデータがありません。')
      return
    }
    setPlaying(true)
    await playLayers(selectedLayers, draft.mixer, () => setPlaying(false))
  }

  const patchVol = (kind: LayerKind, volume: number) => {
    setMixer({
      ...draft.mixer,
      volume: { ...draft.mixer.volume, [kind]: volume },
    })
  }

  const patchMute = (kind: LayerKind, mute: boolean) => {
    setMixer({
      ...draft.mixer,
      mute: { ...draft.mixer.mute, [kind]: mute },
    })
  }

  const patchSolo = (kind: LayerKind, solo: boolean) => {
    setMixer({
      ...draft.mixer,
      solo: { ...draft.mixer.solo, [kind]: solo },
    })
  }

  const layerKeyLabel = (kind: LayerKind): string => {
    if (kind === 'drums') return '—'
    if (kind === 'melody') {
      const k = draft.keySync.melody
        ? draft.meta.keyRoot
        : draft.melody.settings.keyRoot
      return keyOptionLabel(k)
    }
    if (kind === 'chords') {
      const k = draft.keySync.chords ? draft.meta.keyRoot : draft.chords.keyRoot
      return keyOptionLabel(k)
    }
    const k = draft.keySync.bass ? draft.meta.keyRoot : draft.bass.keyRoot
    return keyOptionLabel(k)
  }

  const counts = {
    melody: draft.melody.stage.length,
    chords: draft.chords.stage.length,
    bass: draft.bass.stage.length,
    drums: draft.drums.stage.length,
  }

  return (
    <div className="app layer-page layer-page--arrange">
      <header className="app__header">
        <h1>まとめ再生</h1>
        <p className="app__lead">
          「含める」にチェックしたレイヤだけをまとめて再生・WAV / MIDI 書き出しできます。
          音量・ミュート・ソロもここで調整します。
        </p>
      </header>

      {warnings.length > 0 && (
        <div className="arrange-warn" role="status">
          {warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
          <p>キーが食い違ったまま再生します。</p>
        </div>
      )}

      <section className="app__section">
        <h2>ミキサー</h2>
        <table className="mixer-table">
          <thead>
            <tr>
              <th>含める</th>
              <th>レイヤ</th>
              <th>内容</th>
              <th>キー</th>
              <th>音量</th>
              <th>Mute</th>
              <th>Solo</th>
            </tr>
          </thead>
          <tbody>
            {LAYERS.map((kind) => (
              <tr key={kind}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`${LAYER_LABELS[kind]}を含める`}
                    checked={draft.layerInclude[kind]}
                    onChange={(e) =>
                      setLayerInclude({ [kind]: e.target.checked })
                    }
                  />
                </td>
                <td>{LAYER_LABELS[kind]}</td>
                <td>
                  {kind === 'chords'
                    ? `${counts.chords}コード`
                    : kind === 'drums'
                      ? `${counts.drums}パターン`
                      : `${counts[kind]}小節`}
                </td>
                <td>{layerKeyLabel(kind)}</td>
                <td>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={draft.mixer.volume[kind]}
                    onChange={(e) =>
                      patchVol(kind, Number(e.target.value))
                    }
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={draft.mixer.mute[kind]}
                    onChange={(e) => patchMute(kind, e.target.checked)}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={draft.mixer.solo[kind]}
                    onChange={(e) => patchSolo(kind, e.target.checked)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="layer-controls" style={{ marginTop: 16 }}>
          {playing ? (
            <button
              type="button"
              className="btn"
              onClick={() => void stopPlayback().then(() => setPlaying(false))}
            >
              停止
            </button>
          ) : (
            <button
              type="button"
              className="btn primary"
              onClick={() => void playSelected()}
            >
              チェックしたレイヤを再生
            </button>
          )}
          <button
            type="button"
            className="btn"
            disabled={exporting || selectedCount === 0}
            onClick={() => {
              downloadMultiTrackMidi(selectedLayers)
            }}
          >
            MIDI（チェック分）
          </button>
          <button
            type="button"
            className="btn"
            disabled={exporting || selectedCount === 0}
            onClick={() => {
              setExporting(true)
              void downloadMixWav(
                selectedLayers,
                draft.mixer,
                'arrangement.wav',
              )
                .catch((err: unknown) => {
                  console.error(err)
                  const msg =
                    err instanceof Error ? err.message : String(err)
                  window.alert(`WAV の書き出しに失敗しました。\n${msg}`)
                })
                .finally(() => setExporting(false))
            }}
          >
            {exporting ? 'WAV生成中…' : 'WAV（チェック分をミックス）'}
          </button>
        </div>
        <p className="layer-hint">
          「含める」がオフのレイヤは再生・書き出しから除外されます。Mute / Solo
          はチェック済みレイヤの聴こえ方の調整用です。
        </p>
      </section>
    </div>
  )
}

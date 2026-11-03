import { useMemo, useState } from 'react'
import { playLayers } from '../audio/player'
import { PlayStopButton } from '../components/PlayStopButton'
import { TonePicker } from '../components/TonePicker'
import { downloadMultiTrackMidi } from '../export/midi'
import { downloadMixWav, filterLayersByInclude } from '../export/wav'
import { collectKeyWarnings, useProject } from '../core/ProjectContext'
import { LAYER_LABELS, type LayerKind } from '../core/projectTypes'
import { keyOptionLabel } from '../core/scale'
import '../pages/ComposerPage.css'
import './LayerPages.css'

const LAYERS: LayerKind[] = ['melody', 'chords', 'bass', 'drums']

export default function ArrangePage() {
  const { draft, setMixer, setLayerInclude, setTones } = useProject()
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
    await playLayers(selectedLayers, draft.mixer, undefined, {
      chordPlayStyle: draft.chords.playStyle ?? 'block',
      tones: draft.tones,
    })
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
        <h1>出力</h1>
        <p className="app__lead">
          できた曲をファイルにします。WAV は聴ける音声、MIDI はパートごとのデータです。
        </p>
      </header>

      {warnings.length > 0 && (
        <div className="arrange-warn" role="status">
          {warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
          <p>キーが食い違ったまま書き出します。</p>
        </div>
      )}

      <section className="app__section">
        <h2>ファイルにする</h2>
        <div className="export-actions">
          <button
            type="button"
            className="btn primary"
            disabled={exporting || selectedCount === 0}
            onClick={() => {
              setExporting(true)
              void downloadMixWav(
                selectedLayers,
                draft.mixer,
                'song.wav',
                draft.chords.playStyle ?? 'block',
                draft.tones,
              )
                .catch((err: unknown) => {
                  console.error(err)
                  const msg = err instanceof Error ? err.message : String(err)
                  window.alert(`WAV の書き出しに失敗しました。\n${msg}`)
                })
                .finally(() => setExporting(false))
            }}
          >
            {exporting ? 'WAVを作っています…' : 'WAVで保存'}
          </button>
          <button
            type="button"
            className="btn"
            disabled={exporting || selectedCount === 0}
            onClick={() => {
              downloadMultiTrackMidi(selectedLayers, 'song.mid', draft.tones)
            }}
          >
            MIDIで保存
          </button>
          <PlayStopButton
            label="書き出す音を聴く"
            className="btn btn--score"
            disabled={selectedCount === 0}
            onPlay={() => void playSelected()}
          />
        </div>
        <p className="layer-hint">
          チェックしたパートだけが入ります。音量・ミュート・ソロも、聴くときとファイルの両方に反映されます。
        </p>
      </section>

      <section className="app__section">
        <h2>書き出す音色</h2>
        <p className="layer-hint">
          メロディ、コード、ベースの鳴り方です。WAV と MIDI に入ります。
        </p>
        <TonePicker tones={draft.tones} onChange={setTones} />
      </section>

      <section className="app__section">
        <h2>含めるパート</h2>
        <table className="mixer-table">
          <thead>
            <tr>
              <th>含める</th>
              <th>パート</th>
              <th>内容</th>
              <th>キー</th>
              <th>音量</th>
              <th>ミュート</th>
              <th>ソロ</th>
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

        <p className="layer-hint">
          オフにしたパートはファイルに入りません。ミュートはそのパートを消し、ソロはそれだけを残します。
        </p>
      </section>
    </div>
  )
}

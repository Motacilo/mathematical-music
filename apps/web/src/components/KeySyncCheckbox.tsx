import { useProject } from '../core/ProjectContext'

export function KeySyncCheckbox({
  layer,
}: {
  layer: 'melody' | 'chords' | 'bass'
}) {
  const { draft, setKeySync } = useProject()
  const checked = draft.keySync[layer]
  return (
    <label className="key-sync">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => setKeySync({ [layer]: e.target.checked })}
      />
      プロジェクトキーに合わせる
    </label>
  )
}

import { usePlayback } from '../audio/usePlayback'

type PlayStopButtonProps = {
  /** Label when idle (e.g. 譜面を再生 / 聴く) */
  label: string
  onPlay: () => void | Promise<void>
  /** Disabled only while idle (not playing) */
  disabled?: boolean
  className?: string
  title?: string
}

/**
 * Shows `label` to start playback, or 「停止」 while anything is playing.
 * Stop always halts all layers.
 */
export function PlayStopButton({
  label,
  onPlay,
  disabled = false,
  className,
  title,
}: PlayStopButtonProps) {
  const { playing, stop } = usePlayback()
  const idleClass = className
  const stopClass =
    className && className.includes('btn')
      ? className.replace(/\bbtn--score\b/g, '').replace(/\bprimary\b/g, '').trim() ||
        'btn'
      : className

  return (
    <button
      type="button"
      className={playing ? stopClass : idleClass}
      title={playing ? '再生を停止' : title}
      disabled={!playing && disabled}
      onClick={() => {
        if (playing) void stop()
        else void onPlay()
      }}
    >
      {playing ? '停止' : label}
    </button>
  )
}

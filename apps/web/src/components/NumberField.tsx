import { useEffect, useState } from 'react'

type NumberFieldProps = {
  value: number
  min: number
  max: number
  onCommit: (value: number) => void
  className?: string
  'aria-label'?: string
}

/**
 * Whole-number input you can empty and retype. Digits only. A value in range
 * applies as you type; one outside the range is pulled to the nearest allowed
 * number when you leave the field (or press Enter). Left empty, it goes back.
 */
export function NumberField({ value, min, max, onCommit, className, ...rest }: NumberFieldProps) {
  const [text, setText] = useState(String(value))

  useEffect(() => {
    setText(String(value))
  }, [value])

  const commit = () => {
    if (text === '') {
      setText(String(value))
      return
    }
    const n = Math.min(max, Math.max(min, Number(text)))
    setText(String(n))
    if (n !== value) onCommit(n)
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      className={className}
      aria-label={rest['aria-label']}
      value={text}
      onChange={(e) => {
        const next = e.target.value
        if (!/^\d*$/.test(next)) return
        setText(next)
        const n = Number(next)
        if (next !== '' && n >= min && n <= max && n !== value) onCommit(n)
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
      onFocus={(e) => e.target.select()}
    />
  )
}

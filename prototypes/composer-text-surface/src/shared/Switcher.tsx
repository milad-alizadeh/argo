// PROTOTYPE. The floating variant bar. Deliberately high-contrast: it is not part of the design
// being judged.

import { useEffect } from 'react'

type Props = {
  keys: string[]
  names: Record<string, string>
  current: string
  onChange(key: string): void
}

export function Switcher({ keys, names, current, onChange }: Props) {
  const at = Math.max(0, keys.indexOf(current))
  const step = (by: number) => onChange(keys[(at + by + keys.length) % keys.length] as string)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Never steal an arrow from a field somebody is typing in.
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.isContentEditable ||
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.closest('.cm-editor'))
      ) {
        return
      }
      if (event.key === 'ArrowLeft') step(-1)
      if (event.key === 'ArrowRight') step(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="switcher">
      <button type="button" onClick={() => step(-1)} aria-label="Previous variant">
        ‹
      </button>
      <span className="label">
        {current} · {names[current]}
      </span>
      <button type="button" onClick={() => step(1)} aria-label="Next variant">
        ›
      </button>
    </div>
  )
}

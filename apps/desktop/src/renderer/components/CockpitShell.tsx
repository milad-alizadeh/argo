// The window's two-band frame: the chrome bar over a sidebar and a deck. The `data-component`
// names are the ones the design ticket froze (#1896), and the appearance capture finds the screen
// through them.
import type { ReactNode } from 'react'

export function CockpitShell({
  chrome,
  sidebar,
  deck,
}: {
  chrome: ReactNode
  sidebar: ReactNode
  deck: ReactNode
}) {
  return (
    <div
      data-component="CockpitShell"
      className="grid h-screen w-screen grid-rows-[var(--size-chrome-bar)_1fr] overflow-hidden"
    >
      {chrome}
      <div className="grid min-h-0 grid-cols-[var(--size-sidebar)_1fr]">
        {sidebar}
        {deck}
      </div>
    </div>
  )
}

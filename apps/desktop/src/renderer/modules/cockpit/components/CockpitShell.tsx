// The window's two-band frame: the chrome bar over a sidebar and a deck. The `data-component`
// names are the ones the design ticket froze (#1896), and the appearance capture finds the screen
// through them.
import type { ReactNode } from 'react'

// With no Project open there is nothing to navigate, so the sidebar is absent rather than empty
// and the deck takes the window. `notice` is the band a refusal lands in while a Project is open:
// the surfaces keep working, and the answer the chooser gave is still on screen.
export function CockpitShell({
  chrome,
  notice,
  sidebar,
  deck,
}: {
  chrome: ReactNode
  notice?: ReactNode
  sidebar?: ReactNode
  deck: ReactNode
}) {
  return (
    <div
      data-component="CockpitShell"
      className="grid h-screen w-screen grid-rows-[var(--size-chrome-bar)_auto_1fr] overflow-hidden"
    >
      {chrome}
      {notice ? <div className="border-b px-4 py-2">{notice}</div> : <div />}
      <div
        className={
          sidebar ? 'grid min-h-0 grid-cols-[var(--size-sidebar)_1fr]' : 'grid min-h-0 grid-cols-1'
        }
      >
        {sidebar}
        {deck}
      </div>
    </div>
  )
}

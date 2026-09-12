// The Session shell: a navigation rail beside a Roster, workspace, and inspector. A Project that
// is not open still takes the whole window, and the appearance capture finds it by this name.
import type { ReactNode } from 'react'

// With no Project open there is nothing to navigate, so the sidebar is absent rather than empty
// and the deck takes the window. `notice` is the band a refusal lands in while a Project is open:
// the surfaces keep working, and the answer the chooser gave is still on screen.
export function CockpitShell({
  rail,
  roster,
  rosterHeader,
  workspaceHeader,
  notice,
  deck,
  inspector,
}: {
  rail?: ReactNode
  roster?: ReactNode
  rosterHeader?: ReactNode
  workspaceHeader?: ReactNode
  notice?: ReactNode
  deck: ReactNode
  inspector?: ReactNode
}) {
  let layout = 'grid-cols-1'
  if (rail) layout = 'grid-cols-[var(--size-navigation-rail)_minmax(0,1fr)]'
  if (rail && roster && rosterHeader && inspector) {
    layout =
      'grid-cols-[var(--size-navigation-rail)_var(--size-session-roster)_minmax(0,1fr)_var(--size-session-inspector)]'
  }
  return (
    <div
      data-component="CockpitShell"
      className={`grid h-screen w-screen ${layout} overflow-hidden bg-background`}
    >
      {rail}
      {roster && rosterHeader ? (
        <aside aria-label="Project roster" className="flex min-h-0 flex-col border-r bg-card">
          {rosterHeader}
          <div className="min-h-0 flex-1 bg-card">{roster}</div>
        </aside>
      ) : null}
      <div className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden bg-background">
        {workspaceHeader}
        {notice ? (
          <div className="border-b px-(--spacing-shell-inset) py-(--spacing-shell-item)">
            {notice}
          </div>
        ) : (
          <div />
        )}
        {deck}
      </div>
      {inspector}
    </div>
  )
}

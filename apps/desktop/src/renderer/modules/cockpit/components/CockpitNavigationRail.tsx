import { memo } from 'react'
import { Bot, FolderGit2, Map as MapIcon, Settings, Ticket } from 'lucide-react'

export const CockpitNavigationRail = memo(function CockpitNavigationRail() {
  const showsNativeTrafficLights = typeof window.argo?.versions?.electron === 'string'

  return (
    <nav
      aria-label="Main navigation"
      className="flex min-h-0 w-(--size-navigation-rail) shrink-0 flex-col items-center bg-muted [&_svg]:size-(--size-icon-control)"
    >
      <div className="drag-region relative h-(--size-chrome-bar) w-full shrink-0">
        {showsNativeTrafficLights ? null : (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-(--inset-traffic-light-control) left-(--inset-traffic-light-control) flex gap-2"
          >
            <span className="size-(--size-traffic-light) rounded-full bg-traffic-light-close ring-1 ring-black/10" />
            <span className="size-(--size-traffic-light) rounded-full bg-traffic-light-minimize ring-1 ring-black/10" />
            <span className="size-(--size-traffic-light) rounded-full bg-traffic-light-zoom ring-1 ring-black/10" />
          </div>
        )}
      </div>
      <div className="-mt-px flex flex-col items-center gap-2">
        <button type="button" aria-current="page" aria-label="Sessions" className="grid size-9 place-items-center rounded-lg bg-background text-foreground shadow-sm ring-1 ring-border/70">
          <Bot />
        </button>
        <button type="button" aria-label="Tickets" className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-background/70 hover:text-foreground">
          <Ticket />
        </button>
        <button type="button" aria-label="Atlas" className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-background/70 hover:text-foreground">
          <MapIcon />
        </button>
        <button type="button" aria-label="Files" className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-background/70 hover:text-foreground">
          <FolderGit2 />
        </button>
      </div>
      <div className="mt-auto flex h-(--size-bottom-status) shrink-0 items-center justify-center pb-1">
        <button type="button" aria-label="Settings" className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-background/70 hover:text-foreground">
          <Settings />
        </button>
      </div>
    </nav>
  )
})

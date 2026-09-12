import { memo, useEffect, useState } from 'react'
import { Bot, FolderGit2, Map as MapIcon, Settings, Ticket } from 'lucide-react'

type NavigationDestination = 'Sessions' | 'Tickets' | 'Atlas' | 'Files'

const navigationItems: { destination: NavigationDestination; icon: typeof Bot }[] = [
  { destination: 'Sessions', icon: Bot },
  { destination: 'Tickets', icon: Ticket },
  { destination: 'Atlas', icon: MapIcon },
  { destination: 'Files', icon: FolderGit2 },
]

function destinationFromHash(): NavigationDestination {
  const destination = window.location.hash.split('/')[1]
  if (destination === 'tickets') return 'Tickets'
  if (destination === 'atlas') return 'Atlas'
  return 'Sessions'
}

export const CockpitNavigationRail = memo(function CockpitNavigationRail() {
  const [destination, setDestination] = useState(destinationFromHash)

  useEffect(() => {
    const updateDestination = () => setDestination(destinationFromHash())
    window.addEventListener('hashchange', updateDestination)
    return () => window.removeEventListener('hashchange', updateDestination)
  }, [])

  const navigate = (nextDestination: NavigationDestination) => {
    if (nextDestination === 'Files') return
    window.location.hash = `/${nextDestination.toLowerCase()}`
  }

  return (
    <nav
      aria-label="Main navigation"
      className="flex h-full min-h-0 w-(--size-navigation-rail) shrink-0 flex-col items-center bg-muted [&_svg]:size-(--size-icon-control)"
    >
      <div className="drag-region h-(--size-chrome-bar) w-full shrink-0" />
      <div className="-mt-px flex flex-col items-center gap-2">
        {navigationItems.map(({ destination: itemDestination, icon: Icon }) => {
          const active = destination === itemDestination
          return (
            <button
              key={itemDestination}
              type="button"
              aria-current={active ? 'page' : undefined}
              aria-label={itemDestination}
              className="group flex flex-col items-center gap-1 type-label"
              onClick={() => navigate(itemDestination)}
            >
              <span
                className={`grid size-9 place-items-center rounded-lg transition-colors ${
                  active
                    ? 'bg-card text-foreground ring-1 ring-border/70'
                    : 'text-muted-foreground group-hover:bg-sidebar group-hover:text-foreground'
                }`}
              >
                <Icon />
              </span>
              <span className={active ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                {itemDestination}
              </span>
            </button>
          )
        })}
      </div>
      <div className="mt-auto flex h-(--size-bottom-status) shrink-0 items-center justify-center pb-1">
        <button type="button" aria-label="Settings" className="group flex flex-col items-center gap-1 type-label">
          <span className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors group-hover:bg-sidebar group-hover:text-foreground">
            <Settings />
          </span>
          <span className="text-muted-foreground">Settings</span>
        </button>
      </div>
    </nav>
  )
})

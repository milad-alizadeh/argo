import { type LucideIcon, Map as MapIcon, MessagesSquare, Settings, Ticket } from 'lucide-react'
import { memo, useEffect, useState } from 'react'

import { DESTINATION_PATHS, DESTINATIONS, type Destination } from '@/core/commands/shortcuts'

const navigationIcons: Record<Destination, LucideIcon> = {
  Sessions: MessagesSquare,
  Tickets: Ticket,
  Atlas: MapIcon,
}

function destinationFromHash(): Destination {
  return (
    DESTINATIONS.find(
      (destination) => window.location.hash === `#${DESTINATION_PATHS[destination]}`,
    ) ?? 'Sessions'
  )
}

export const CockpitNavigationRail = memo(function CockpitNavigationRail() {
  const [destination, setDestination] = useState(destinationFromHash)

  useEffect(() => {
    const updateDestination = () => setDestination(destinationFromHash())
    window.addEventListener('hashchange', updateDestination)
    return () => window.removeEventListener('hashchange', updateDestination)
  }, [])

  return (
    <nav
      aria-label="Main navigation"
      className="flex h-full min-h-0 w-(--size-navigation-rail) shrink-0 flex-col items-center bg-muted [&_svg]:size-(--size-icon-control)"
    >
      <div className="drag-region h-(--size-chrome-bar) w-full shrink-0" />
      <div className="-mt-px flex flex-col items-center gap-2">
        {DESTINATIONS.map((itemDestination) => {
          const Icon = navigationIcons[itemDestination]
          const active = destination === itemDestination
          return (
            <button
              key={itemDestination}
              type="button"
              aria-current={active ? 'page' : undefined}
              aria-label={itemDestination}
              className="group flex flex-col items-center gap-1 type-label"
              onClick={() => {
                window.location.hash = DESTINATION_PATHS[itemDestination]
              }}
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
        <button
          type="button"
          aria-label="Settings"
          className="group flex flex-col items-center gap-1 type-label"
        >
          <span className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors group-hover:bg-sidebar group-hover:text-foreground">
            <Settings />
          </span>
          <span className="text-muted-foreground">Settings</span>
        </button>
      </div>
    </nav>
  )
})

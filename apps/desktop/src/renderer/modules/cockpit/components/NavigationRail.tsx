// The Session shell's primary navigation: an opaque muted rail that keeps the Project roster and
// the workspace separate (ADR-0038).
import { BotIcon, Code2Icon, MapIcon, TicketIcon } from 'lucide-react'
import type { ComponentType } from 'react'
import type { Appearance } from '@/core/appearance/appearance'
import { DESTINATIONS, type Destination } from '@/core/commands/shortcuts'
import { AppearanceControl } from '../../appearance/components/AppearanceControl'

const ICONS: Record<Destination, ComponentType<{ className?: string }>> = {
  Sessions: BotIcon,
  Tickets: TicketIcon,
  Atlas: MapIcon,
  Code: Code2Icon,
}

export function NavigationRail({
  appearance,
  destination,
  onAppearanceChange,
  onNavigate,
}: {
  appearance: Appearance
  destination: Destination
  onAppearanceChange: (appearance: Appearance) => void
  onNavigate: (destination: Destination) => void
}) {
  return (
    <nav
      aria-label="Main navigation"
      className="flex min-h-0 flex-col items-center bg-muted"
      data-component="NavigationRail"
      style={{ width: 'var(--size-navigation-rail)' }}
    >
      <div aria-hidden="true" className="drag-region h-(--size-chrome-bar) w-full shrink-0" />
      <div className="flex flex-col items-center gap-(--spacing-shell-item)">
        {DESTINATIONS.map((candidate) => {
          const Icon = ICONS[candidate]
          const selected = candidate === destination
          return (
            <button
              aria-current={selected ? 'page' : undefined}
              aria-label={candidate}
              className="flex w-full flex-col items-center gap-(--spacing-shell-tight) rounded-(--radius-lg) px-(--spacing-shell-item) py-(--spacing-shell-tight) text-control text-muted-foreground hover:text-foreground aria-[current=page]:text-foreground"
              key={candidate}
              onClick={() => onNavigate(candidate)}
              type="button"
            >
              <span
                className={`grid size-(--size-navigation-item) place-items-center rounded-(--radius-lg) ${selected ? 'bg-card' : ''}`}
              >
                <Icon aria-hidden="true" className="size-(--size-icon-control)" />
              </span>
              <span>{candidate}</span>
            </button>
          )
        })}
      </div>
      <div className="mt-auto flex h-(--size-chrome-bar) items-center justify-center">
        <AppearanceControl appearance={appearance} compact onChange={onAppearanceChange} />
      </div>
    </nav>
  )
}

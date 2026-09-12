// The Project roster's card ground. Its shell owns the one trailing hairline (ADR-0038). Every
// working surface is a row here, Code included, because a destination nobody can reach is a
// destination nobody notices is missing.
import { DESTINATIONS, type Destination } from '@/core/commands/shortcuts'
import { NavigationRow } from './NavigationRow'

export function Sidebar({
  destination,
  onNavigate,
}: {
  destination: Destination
  onNavigate: (chosen: Destination) => void
}) {
  return (
    <nav
      data-component="Sidebar"
      aria-label="Surfaces"
      className="flex flex-col gap-0.5 bg-card p-2"
    >
      {DESTINATIONS.map((candidate) => (
        <NavigationRow
          key={candidate}
          label={candidate}
          selected={candidate === destination}
          onSelect={() => onNavigate(candidate)}
        />
      ))}
    </nav>
  )
}

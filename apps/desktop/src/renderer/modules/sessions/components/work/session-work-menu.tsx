// One button in the Session header per kind of background work, each carrying its own count and
// opening its own list (#1582). The button is the whole permanent footprint: nothing is parked in
// the inspector, so the Feed keeps its width until the reader asks for something.
import type { LucideIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/renderer/components/ui/dropdown-menu'
import { cn } from '@/renderer/lib/utils'
import type { WorkEntry } from './session-work-entries'

function Row({
  entry,
  onSelect,
  selected,
}: {
  entry: WorkEntry
  onSelect: () => void
  selected: boolean
}) {
  return (
    <DropdownMenuItem
      aria-current={selected}
      className={cn('items-start gap-2 py-1.5', selected ? 'bg-accent' : null)}
      onClick={onSelect}
    >
      <span
        aria-hidden="true"
        className={cn(
          'mt-(--spacing-dot-inset) size-(--size-state-dot) shrink-0 rounded-full',
          entry.mark,
        )}
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn('block truncate text-foreground', entry.monospace ? 'font-mono' : null)}
        >
          {entry.title}
        </span>
        <span className="block truncate type-meta text-muted-foreground">
          {[entry.state, entry.facts].filter((fact) => fact !== '').join(' · ')}
        </span>
      </span>
    </DropdownMenuItem>
  )
}

function Group({
  entries,
  label,
  onSelect,
  selectedId,
}: {
  entries: readonly WorkEntry[]
  label: string
  onSelect: (id: string) => void
  selectedId: string | null
}) {
  if (entries.length === 0) return null
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel className="type-meta text-muted-foreground">{label}</DropdownMenuLabel>
      {entries.map((entry) => (
        <Row
          key={entry.id}
          entry={entry}
          selected={entry.id === selectedId}
          onSelect={() => onSelect(entry.id)}
        />
      ))}
    </DropdownMenuGroup>
  )
}

// A notification badge pinned to the icon's corner. It is green while anything is still going and
// grey once everything has come back, so the count answers "is something still running" without
// the list being opened. The ring cuts it out of the icon beneath it.
function Badge({ count, running }: { count: number; running: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'absolute -top-1 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 text-badge leading-none font-semibold tabular-nums ring-2 ring-background',
        running ? 'bg-active text-background' : 'bg-muted-foreground text-background',
      )}
    >
      {count}
    </span>
  )
}

export function SessionWorkMenu({
  entries,
  icon: Icon,
  label,
  onSelect,
  selectedId,
}: {
  entries: readonly WorkEntry[]
  icon: LucideIcon
  // What the button is called out loud, and what its two groups are called under it.
  label: string
  onSelect: (id: string) => void
  selectedId: string | null
}) {
  if (entries.length === 0) return null
  const running = entries.filter((entry) => entry.running)
  const finished = entries.filter((entry) => !entry.running)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${label} · ${entries.length}`}
        className="relative flex size-(--size-control) shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[popup-open]:bg-accent data-[popup-open]:text-foreground"
      >
        <Icon aria-hidden="true" className="size-(--size-icon-control)" />
        <Badge count={entries.length} running={running.length > 0} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-(--size-session-popover)">
        <Group entries={running} label="Running" onSelect={onSelect} selectedId={selectedId} />
        {running.length > 0 && finished.length > 0 ? <DropdownMenuSeparator /> : null}
        <Group entries={finished} label="Finished" onSelect={onSelect} selectedId={selectedId} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

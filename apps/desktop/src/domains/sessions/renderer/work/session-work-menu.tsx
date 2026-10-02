// One button in the Session header per kind of background work, each carrying its own count and
// opening its own list (#1582). The button is the whole permanent footprint: nothing is parked in
// the inspector, so the Feed keeps its width until the reader asks for something.

import { statusToneRecipe } from '@/platform/renderer/components/design-system/tone-recipes'
import { MenuDropdownTrigger } from '@/platform/renderer/components/dropdown-trigger'
import type { IconName } from '@/platform/renderer/components/icon/icon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/platform/renderer/components/ui/dropdown-menu'
import { cn } from '@/platform/renderer/lib/utils'
import type { WorkEntry } from './session-work-entries'

const workRichOptionRecipe = {
  row: 'items-start gap-2 py-1.5',
  mark: 'mt-(--spacing-dot-inset) size-(--size-state-dot) shrink-0 rounded-full',
  content: 'min-w-0 flex-1',
  label: 'block whitespace-normal wrap-anywhere text-foreground',
  detail: 'block whitespace-normal wrap-anywhere type-meta text-muted-foreground',
} as const

const workCountIndicatorRecipe =
  'pointer-events-none absolute -top-1 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 type-meta leading-none font-semibold tabular-nums ring-2 ring-background'

function WorkMenuTrigger({
  icon,
  label,
  count,
  running,
}: {
  icon: IconName
  label: string
  count: number
  running: boolean
}) {
  return (
    <span className="relative shrink-0">
      <MenuDropdownTrigger
        aria-label={`${label} · ${count}`}
        className="size-(--size-control) text-muted-foreground hover:bg-accent hover:text-foreground data-[popup-open]:bg-accent data-[popup-open]:text-foreground"
        icon={icon}
        iconOnly
        label={label}
      />
      <Badge count={count} running={running} />
    </span>
  )
}

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
      className={cn(workRichOptionRecipe.row, selected ? 'bg-accent' : null)}
      onClick={onSelect}
    >
      <span aria-hidden="true" className={cn(workRichOptionRecipe.mark, entry.mark)} />
      <span className={workRichOptionRecipe.content}>
        <span className={cn(workRichOptionRecipe.label, entry.monospace ? 'font-mono' : null)}>
          {entry.title}
        </span>
        <span className="sr-only">{entry.state}</span>
        {entry.facts === '' ? null : (
          <span className={workRichOptionRecipe.detail}>{entry.facts}</span>
        )}
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
// grey when nothing is known to be running. The ring cuts it out of the icon beneath it.
function Badge({ count, running }: { count: number; running: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(workCountIndicatorRecipe, statusToneRecipe[running ? 'success' : 'neutral'])}
    >
      {count}
    </span>
  )
}

export function SessionWorkMenu({
  entries,
  icon,
  label,
  onSelect,
  selectedId,
}: {
  entries: readonly WorkEntry[]
  icon: IconName
  // What the button is called out loud, and what its two groups are called under it.
  label: string
  onSelect: (id: string) => void
  selectedId: string | null
}) {
  if (entries.length === 0) return null
  const running = entries.filter((entry) => entry.status === 'running')
  const unknown = entries.filter((entry) => entry.status === 'unknown')
  const finished = entries.filter(
    (entry) =>
      entry.status === 'completed' || entry.status === 'failed' || entry.status === 'interrupted',
  )
  return (
    <DropdownMenu>
      <WorkMenuTrigger
        icon={icon}
        label={label}
        count={entries.length}
        running={running.length > 0}
      />
      <DropdownMenuContent align="start" className="w-(--size-session-popover)">
        <Group entries={running} label="Running" onSelect={onSelect} selectedId={selectedId} />
        {running.length > 0 && unknown.length > 0 ? <DropdownMenuSeparator /> : null}
        {unknown.length > 0 ? (
          <Group
            entries={unknown}
            label={unknown[0]?.state ?? ''}
            onSelect={onSelect}
            selectedId={selectedId}
          />
        ) : null}
        {(running.length > 0 || unknown.length > 0) && finished.length > 0 ? (
          <DropdownMenuSeparator />
        ) : null}
        <Group entries={finished} label="Finished" onSelect={onSelect} selectedId={selectedId} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

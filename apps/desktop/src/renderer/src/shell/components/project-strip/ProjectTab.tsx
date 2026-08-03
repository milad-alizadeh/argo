import { cn } from '@/lib/utils'
import { StatusDot, Text, Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui'
import type { ProjectTabView } from '../../shellModel'

const TAB_BASE =
  'relative grid size-project-tab cursor-pointer place-items-center rounded-lg bg-inset text-muted-foreground inset-lip transition-colors duration-fast hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50'

// The rail is a positioned decorative span, never a `border-*`: cn() collapses same-group
// border-colour utilities, so a rail expressed as a border silently renders 0px over a frame
// that already sets one.
const ACTIVE_RAIL =
  'absolute top-1/2 -left-gap h-row w-hair -translate-y-1/2 rounded-hair bg-primary text-primary glow'

type ProjectTabProps = {
  /** The projected tab: its glyph, whether it is the active project, and the one worst-state dot. */
  tab: ProjectTabView
  /** Make this project the active one. Swapping is a view change, not a teardown. */
  onSelect: () => void
}

/**
 * Molecule: one project in the strip, drawn as its initial.
 *
 * The strip's job is the projects you are NOT looking at, so the active tab is deliberately
 * quiet and never dotted; an inactive tab carries the one worst-state dot its sessions earned.
 * The active tab is the only place the project's name and `last synced` appear at all, and they
 * appear on hover.
 */
export function ProjectTab({ tab, onSelect }: ProjectTabProps): React.JSX.Element {
  const trigger = (
    <button
      type="button"
      data-component="ProjectTab"
      aria-label={tab.name}
      aria-current={tab.active ? 'true' : undefined}
      onClick={onSelect}
      className={cn(TAB_BASE, tab.active && 'bg-secondary text-foreground-bright')}
    >
      <Text variant="title">{tab.initial}</Text>
      {tab.active ? <span aria-hidden className={ACTIVE_RAIL} /> : null}
      {tab.dot === null ? null : (
        <StatusDot tone={tab.dot} className="absolute -top-hair -right-hair" />
      )}
    </button>
  )
  if (!tab.active) return trigger
  return (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent side="right">
        <Text variant="row" as="div">
          {tab.name}
        </Text>
        {tab.lastSynced === null ? null : (
          <Text variant="meta" as="div" className="text-foreground-faint">
            last synced {tab.lastSynced}
          </Text>
        )}
      </TooltipContent>
    </Tooltip>
  )
}

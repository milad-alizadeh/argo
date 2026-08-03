import { GearIcon, Text } from '@/shared/components/ui'

/**
 * Molecule: `⚙ Archived (n)` at the foot of the rail.
 *
 * It opens the archived list and nothing else — archiving is a status transition a finished session
 * makes by itself, never a button (`cockpit-spec.md` §4.1). As quiet as the spawn row: the sessions
 * behind it are done, and done is not an event that wants the eye.
 */
export function ArchivedFooter({
  count,
  open,
  controls,
  onToggle,
}: {
  /** How many sessions have left the live rail. */
  count: number
  /** Whether the archived list is showing. */
  open: boolean
  /** The id of the list this row opens, for `aria-controls`. */
  controls: string
  onToggle?: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
      className="flex w-full items-center gap-snug rounded-lg px-region py-row text-left text-foreground-faint transition-colors duration-fast hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <GearIcon aria-hidden className="icon-sm" />
      <Text variant="row">{`Archived (${count})`}</Text>
    </button>
  )
}

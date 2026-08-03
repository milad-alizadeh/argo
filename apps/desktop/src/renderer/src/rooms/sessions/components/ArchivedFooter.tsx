import { GearIcon } from '@/shared/components/ui'
import { RailActionRow } from './RailActionRow'

/**
 * Molecule: `⚙ Archived (n)` at the foot of the rail.
 *
 * It opens the archived list and nothing else — archiving is a status transition a finished session
 * makes by itself, never a button (`cockpit-spec.md` §4.1). As quiet as the spawn row, and for the
 * same reason: the sessions behind it are done, and done is not an event that wants the eye.
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
    <RailActionRow
      icon={GearIcon}
      label={`Archived (${count})`}
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
    />
  )
}

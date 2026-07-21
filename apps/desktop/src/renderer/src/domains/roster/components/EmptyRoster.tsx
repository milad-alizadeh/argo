import { CompassIcon } from '@phosphor-icons/react'
import { Text } from '@/shared/components/ui'

/**
 * Molecule: the roster's empty state — a compass and one muted line.
 *
 * Not in the study, which assumes a populated roster; the empty roster is a real state, so it
 * gets a component. It folds into the panel body beneath the Projects header (the header is the
 * Roster's, not this block's), filling the column rather than replacing the whole panel.
 */
export function EmptyRoster(): React.JSX.Element {
  return (
    <div className="flex flex-1 select-none flex-col items-center justify-center gap-3 px-4 text-center">
      <CompassIcon weight="light" size={28} className="text-muted-foreground/70" />
      <Text as="p" variant="row" className="text-muted-foreground">
        No Sessions observed yet.
      </Text>
    </div>
  )
}

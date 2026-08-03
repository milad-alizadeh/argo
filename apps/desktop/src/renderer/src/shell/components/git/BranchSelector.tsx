import { cn } from '@/lib/utils'
import { Button, CaretDownIcon, GitBranchIcon, Text } from '@/shared/components/ui'
import { TrackingCounts } from './TrackingCounts'

type BranchSelectorProps = React.ComponentProps<'button'> & {
  /** The checked-out branch, or the short sha when HEAD is detached — whatever git can
   * honestly call the primary checkout. */
  branch: string
  /** Commits this branch holds that origin does not. Zero renders nothing. */
  ahead: number
  /** Commits origin holds that this branch does not. Zero renders nothing. */
  behind: number
}

/**
 * Molecule: the select trigger for the project's primary checkout — the branch, its tracking
 * distance, and the caret that opens `BranchMenu`.
 *
 * A count renders only when it is non-zero, so a clean branch shows its name and nothing
 * else: two zeroes beside a branch would read as state where there is none. Ahead and behind
 * are separately toned because they are separate facts — one is yours to push, the other is
 * origin's to pull.
 */
export function BranchSelector({
  branch,
  ahead,
  behind,
  className,
  ...rest
}: BranchSelectorProps): React.JSX.Element {
  return (
    <Button
      variant="quiet"
      className={cn('gap-gap data-[state=open]:bg-accent-strong', className)}
      {...rest}
    >
      <GitBranchIcon className="icon-sm text-primary" />
      <Text variant="code" className="text-foreground">
        {branch}
      </Text>
      <TrackingCounts ahead={ahead} behind={behind} />
      <CaretDownIcon className="icon-sm text-foreground-faint" />
    </Button>
  )
}

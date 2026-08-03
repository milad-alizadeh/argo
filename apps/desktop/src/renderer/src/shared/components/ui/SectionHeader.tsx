import { cn } from '@/lib/utils'
import { Text } from './Text'

/**
 * Atom: the uppercase eyebrow that opens a section ("Outcomes  4", "Checks  8f3a1c").
 *
 * The count drops the eyebrow's uppercase and tracking so a sha or a phrase stays
 * readable, and it is separated by the gap alone — a leading `·` after the label reads as
 * a segment missing in front of it, and the count is not a segment of a list.
 *
 * It carries its own bottom inset rather than leaving the space to each section's stack gap: a
 * heading needs more air under it than the rows under it need between them, and one column gap
 * cannot say both. The padding is the header's, so every section says it the same way.
 */
export function SectionHeader({
  label,
  count,
  className,
}: {
  /** The section's name, uppercased by the eyebrow role. */
  label: string
  /** What the section counts. Not always a number — the Checks header counts a sha and a
   * phrase — so it renders without the eyebrow's uppercase and tracking. */
  count?: string | number
  className?: string
}): React.JSX.Element {
  return (
    <div className={cn('flex items-baseline gap-gap pb-gap text-muted-foreground', className)}>
      <Text variant="eyebrow">{label}</Text>
      {count !== undefined && (
        <Text variant="eyebrow" className="text-foreground-faint normal-case tracking-normal">
          {count}
        </Text>
      )}
    </div>
  )
}

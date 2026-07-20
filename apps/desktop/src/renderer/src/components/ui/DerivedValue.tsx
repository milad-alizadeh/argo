import { cn } from '@/lib/utils'

// Atom: a value the cockpit estimated rather than counted (parsed stdout, snapshot diff,
// token-sum estimate). It renders as plain text — provenance lives in `title`, not in
// decoration. `gone` = the tool ran but its output was not captured, so the value is
// absent rather than estimated, and it dims.
export function DerivedValue({
  text,
  title,
  gone = false,
  className,
}: {
  /** The estimate as it should read, already formatted (`~34k tokens`). */
  text: string
  /** Where the estimate came from. Surfaces as the hover tooltip. */
  title: string
  /** The tool ran but its output was not captured, so the value is absent rather than
   * estimated, and it dims. */
  gone?: boolean
  className?: string
}): React.JSX.Element {
  return (
    <span title={title} className={cn(gone && 'text-foreground-faint', className)}>
      {text}
    </span>
  )
}

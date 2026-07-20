import { cn } from '@/lib/utils'

// Atom: the uppercase eyebrow that opens a section ("Outcomes · 4", "Checks · 8f3a1c").
// The count drops the eyebrow's uppercase and tracking so a sha or a phrase stays
// readable.
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
    <div className={cn('flex items-center gap-gap text-muted-foreground', className)}>
      <span className="text-eyebrow">{label}</span>
      {count !== undefined && (
        <span className="text-eyebrow text-foreground-faint normal-case tracking-normal">
          · {count}
        </span>
      )}
    </div>
  )
}

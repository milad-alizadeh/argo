import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Atom: the uppercase eyebrow that opens a section ("Outcomes · 4", "Checks · 8f3a1c").
// The count drops the eyebrow's uppercase and tracking so a sha or a phrase stays
// readable, and the trailing aside is a quiet meta line, not part of the eyebrow.
export function SectionHeader({
  label,
  count,
  trailing,
  className,
}: {
  label: string
  count?: string | number
  trailing?: ReactNode
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
      {trailing !== undefined && (
        <span className="ml-auto text-meta text-foreground-faint">{trailing}</span>
      )}
    </div>
  )
}

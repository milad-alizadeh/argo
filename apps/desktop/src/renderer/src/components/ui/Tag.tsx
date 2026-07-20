import { cn } from '@/lib/utils'

export type TagTone = 'neutral' | 'warn' | 'primary'

const TAG_TONE: Record<TagTone, string> = {
  neutral: 'border-border text-foreground-faint',
  warn: 'border-status-awaiting-input/40 text-status-awaiting-input',
  primary: 'border-primary/40 bg-primary/12 text-primary-soft',
}

// Atom: the mini uppercase bordered badge — a worktree marker, an "uncommitted" flag, a
// declared intent. It labels a row, never acts: nothing here is clickable.
export function Tag({
  label,
  tone,
  className,
}: {
  /** Authored lower-case; the type role uppercases it, so the accessible text stays what
   * the caller wrote. */
  label: string
  /** Which of the three badge treatments to wear. */
  tone: TagTone
  className?: string
}): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-sm border px-snug text-tag',
        TAG_TONE[tone],
        className,
      )}
    >
      {label}
    </span>
  )
}

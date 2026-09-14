// One row of the work rail, and the two facts a row ends with. Shared by the Subagent half and the
// Shell half, which differ only in what they put in the middle (#1582).
import { cn } from '@/renderer/lib/utils'

export function WorkRow({
  children,
  mark,
  markLabel,
  selected,
  onSelect,
}: {
  children: React.ReactNode
  mark: string
  markLabel: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left type-meta transition-colors',
        selected ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <span
        aria-hidden="true"
        className={cn('size-(--size-state-dot) shrink-0 rounded-full', mark)}
      />
      <span className="sr-only">{markLabel}</span>
      {children}
    </button>
  )
}

export function Facts({ duration, tokens }: { duration: string | null; tokens: string | null }) {
  if (duration === null && tokens === null) return null
  return (
    <span className="shrink-0 tabular-nums text-muted-foreground">
      {[duration, tokens === null ? null : `${tokens} tokens`]
        .filter((fact) => fact !== null)
        .join(' · ')}
    </span>
  )
}

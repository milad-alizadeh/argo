import { cn } from '@/lib/utils'

/**
 * Molecule: the one header bar every panel in the spine wears — the roster's "Projects" row and
 * the session panel's breadcrumb are the same chrome, so it lives in one place.
 *
 * The chrome is fixed: the shared strip height (`min-h-strip`, the 41px the Delivery strips also
 * settled on, so the columns' headers line up across the spine), a bottom hairline, and the
 * horizontal inset. Only the content differs, so it arrives through two slots — `left` grows and
 * truncates, `right` stays its natural width at the end. What Text role each slot spends is the
 * caller's call; the bar imposes none.
 */
export function PanelHeader({
  left,
  right,
  className,
}: {
  /** The leading content — an eyebrow, a breadcrumb. Grows to fill and truncates under pressure. */
  left: React.ReactNode
  /** The trailing content pinned to the end — a control or a toggle. Omit for a header with none. */
  right?: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <header
      className={cn(
        'flex min-h-strip shrink-0 items-center gap-gap border-border border-b px-inset py-tight',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-snug">{left}</div>
      {right !== undefined && <div className="flex shrink-0 items-center gap-gap">{right}</div>}
    </header>
  )
}

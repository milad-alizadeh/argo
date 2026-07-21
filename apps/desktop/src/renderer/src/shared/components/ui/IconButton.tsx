import { cn } from '@/lib/utils'

/**
 * Atom: an icon-only, borderless control — just the glyph. The one home for every bare icon
 * button in the chrome (the roster's "+", the session's close "✕", the console's expand chevron),
 * so they read as one family. It is `Button`'s sibling, not a size of it: a `Button` size states a
 * whole text box, and tailwind-merge would not de-dupe our spacing role away underneath it.
 *
 * Icon-only, so it is never silent: `label` is required and both names the control (`aria-label`)
 * and titles it. The glyph is the caller's child, sized by the caller. No border and no ink of its
 * own — it lifts to the foreground on hover and carries the ladder's focus ring.
 */
export function IconButton({
  label,
  className,
  children,
  ...rest
}: Omit<React.ComponentProps<'button'>, 'aria-label'> & {
  /** The control's accessible name — an icon-only control has no visible text to borrow. */
  label: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'grid shrink-0 cursor-pointer place-items-center rounded-md p-hair text-muted-foreground transition-colors duration-fast hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

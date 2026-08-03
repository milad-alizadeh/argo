/**
 * Atom: the space macOS's `hiddenInset` traffic lights occupy, top-left.
 *
 * Argo draws no traffic lights — the window does — so this is a reserve and nothing else: it
 * keeps the bar's first real element from sliding underneath them. Static, with no states.
 */
export function WindowControls(): React.JSX.Element {
  return (
    <span aria-hidden data-component="WindowControls" className="size-traffic-lights shrink-0" />
  )
}

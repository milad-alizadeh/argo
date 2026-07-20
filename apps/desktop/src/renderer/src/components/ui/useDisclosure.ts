import { useState } from 'react'

export type DisclosureProps = {
  /** Drives the state directly — once passed, the component only ever reports intent via
   * `onOpenChange` and never flips itself. */
  open?: boolean
  /** Seeds the internal state when uncontrolled. Ignored once `open` is passed. */
  defaultOpen?: boolean
  /** Every open/closed transition, whether the caller controls it or not. */
  onOpenChange?: (open: boolean) => void
}

/** The controlled-with-uncontrolled-fallback boolean any drawer/disclosure in the cockpit can
 * share: standalone it tracks its own open state seeded by `defaultOpen`; handed `open`, a
 * container drives it and `toggle` only reports through `onOpenChange`. */
export function useDisclosure({
  open,
  defaultOpen = false,
  onOpenChange,
}: DisclosureProps): [boolean, () => void] {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const isControlled = open !== undefined
  const resolvedOpen = isControlled ? open : uncontrolledOpen

  function toggle(): void {
    const next = !resolvedOpen
    if (!isControlled) setUncontrolledOpen(next)
    onOpenChange?.(next)
  }

  return [resolvedOpen, toggle]
}

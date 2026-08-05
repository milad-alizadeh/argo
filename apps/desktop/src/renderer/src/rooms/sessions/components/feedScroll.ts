import { type RefObject, useEffect } from 'react'

// The feed's scroll machinery, with ZERO JavaScript on the scroll path: the seams stick by CSS,
// the minimap window rides a CSS scroll-timeline (see DensityGutter's stylesheet), and stepping
// reads the DOM only on the keypress that asked. Scrolling re-renders nothing.

/** The attribute a chapter section is addressed by — what jumping and stepping aim at. */
export const ANCHOR = 'data-anchor'

const anchorsOf = (root: HTMLElement): HTMLElement[] => [
  ...root.querySelectorAll<HTMLElement>(`[${ANCHOR}]`),
]

/** Which anchor the reader is inside: the last one whose top has crossed a line a third of the way
 * down the pane — computed on demand, never held as state. */
function activeOf(root: HTMLElement, anchors: readonly HTMLElement[]): string | null {
  if (anchors.length === 0) return null
  if (root.scrollTop + root.clientHeight >= root.scrollHeight - 1) {
    return anchors.at(-1)?.getAttribute(ANCHOR) ?? null
  }
  const line = root.getBoundingClientRect().top + root.clientHeight * 0.35
  let current = anchors[0]
  for (const anchor of anchors) {
    if (anchor.getBoundingClientRect().top <= line) current = anchor
  }
  return current?.getAttribute(ANCHOR) ?? null
}

/** Smooth-jump the feed to an anchor. */
export function jumpFeedTo(root: HTMLElement | null, key: string): void {
  root
    ?.querySelector<HTMLElement>(`[${ANCHOR}="${key}"]`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** Step to the anchor before/after the one in view. */
export function stepFeed(root: HTMLElement | null, delta: number): void {
  if (!root) return
  const anchors = anchorsOf(root)
  const at = anchors.findIndex((anchor) => anchor.getAttribute(ANCHOR) === activeOf(root, anchors))
  const next = anchors[Math.min(anchors.length - 1, Math.max(0, at + delta))]
  const key = next?.getAttribute(ANCHOR)
  if (key !== null && key !== undefined) jumpFeedTo(root, key)
}

/**
 * Sizes the minimap's viewport window. Its MOTION is pure CSS — a scroll-driven animation on the
 * feed's own scroll-timeline — so nothing here listens to scroll. The one thing CSS cannot read is
 * the visible FRACTION of the feed (`clientHeight / scrollHeight`), so that ratio is measured here,
 * once per content change (`key`) and viewport resize.
 */
export function useMinimapWindow(
  feed: RefObject<HTMLElement | null>,
  overlay: RefObject<HTMLElement | null>,
  key: string,
): void {
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` says the feed's content changed; re-measuring on it is the point.
  useEffect(() => {
    const root = feed.current
    const win = overlay.current
    if (!root || !win) return
    const size = (): void => {
      win.style.height = `${Math.min(1, root.clientHeight / root.scrollHeight) * 100}%`
    }
    size()
    const observer = new ResizeObserver(size)
    observer.observe(root)
    return () => observer.disconnect()
  }, [feed, overlay, key])
}

/** `⌥↑`/`⌥↓` stepping, hung off the window so it works wherever focus is. */
export function useStepKeys(step: (delta: number) => void): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!event.altKey) return
      if (event.key === 'ArrowUp') step(-1)
      if (event.key === 'ArrowDown') step(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step])
}

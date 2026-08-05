import { type RefObject, useCallback, useEffect, useState } from 'react'

// PROTOTYPE. A local scroll-spy rather than the kit's `useFeedHighlight`, for two reasons: the
// variants need the scroll RATIO as well as the active key (the gutter draws a viewport window from
// it), and the kit's spy attribute is not on the module's public entry.

export const ANCHOR = 'data-anchor'

export interface FeedScroll {
  /** Which anchor most recently crossed the trip line — what you are looking at. */
  activeKey: string | null
  /** `0..1` of the way down the feed, and the fraction of it visible. The gutter's window. */
  progress: number
  visible: number
  jumpTo: (key: string) => void
  /** Step to the anchor before/after the active one — what `⌥↑`/`⌥↓` are wired to. */
  step: (delta: number) => void
}

const anchorsOf = (root: HTMLElement): HTMLElement[] => [
  ...root.querySelectorAll<HTMLElement>(`[${ANCHOR}]`),
]

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

/** Everything the variants need to know about where the reader is in the feed. */
export function useFeedScroll(feed: RefObject<HTMLElement | null>, keys: string): FeedScroll {
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(1)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `keys` is the signature that says the anchor list changed; re-measuring on it is the point.
  useEffect(() => {
    const root = feed.current
    if (!root) return
    const anchors = anchorsOf(root)
    let frame = 0
    const measure = (): void => {
      frame = 0
      setActiveKey(activeOf(root, anchors))
      const scrollable = Math.max(1, root.scrollHeight - root.clientHeight)
      setProgress(root.scrollTop / scrollable)
      setVisible(Math.min(1, root.clientHeight / root.scrollHeight))
    }
    const onScroll = (): void => {
      if (frame === 0) frame = requestAnimationFrame(measure)
    }
    measure()
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      root.removeEventListener('scroll', onScroll)
      if (frame !== 0) cancelAnimationFrame(frame)
    }
  }, [feed, keys])

  const jumpTo = useCallback(
    (key: string) => {
      const root = feed.current
      const target = root?.querySelector<HTMLElement>(`[${ANCHOR}="${key}"]`)
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
    [feed],
  )

  const step = useCallback(
    (delta: number) => {
      const root = feed.current
      if (!root) return
      const keyList = anchorsOf(root).map((anchor) => anchor.getAttribute(ANCHOR) ?? '')
      const at = keyList.indexOf(activeKey ?? '')
      const next = keyList[Math.min(keyList.length - 1, Math.max(0, at + delta))]
      if (next !== undefined && next !== '') jumpTo(next)
    },
    [feed, activeKey, jumpTo],
  )

  return { activeKey, progress, visible, jumpTo, step }
}

/** Smooth-jump the feed to an anchor. Standalone, so a caller with no spy state can still aim. */
export function jumpFeedTo(root: HTMLElement | null, key: string): void {
  root
    ?.querySelector<HTMLElement>(`[${ANCHOR}="${key}"]`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** Step to the anchor before/after the one in view, computing "in view" ON DEMAND from the DOM
 * rather than from React state — stepping happens once per keypress, so it needs no live spy. */
export function stepFeed(root: HTMLElement | null, delta: number): void {
  if (!root) return
  const anchors = anchorsOf(root)
  const at = anchors.findIndex((anchor) => anchor.getAttribute(ANCHOR) === activeOf(root, anchors))
  const next = anchors[Math.min(anchors.length - 1, Math.max(0, at + delta))]
  const key = next?.getAttribute(ANCHOR)
  if (key !== null && key !== undefined) jumpFeedTo(root, key)
}

/**
 * The minimap's viewport window WITHOUT React: the scroll handler writes `top`/`height` straight
 * onto the overlay element, one write per animation frame, so a scroll re-renders nothing at all.
 * The seams' stickiness is pure CSS already — this removes the last per-frame setState, which is
 * what made scrolling stutter: every frame re-rendered the whole feed to move a 24px overlay.
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
    let frame = 0
    const paint = (): void => {
      frame = 0
      const visible = Math.min(1, root.clientHeight / root.scrollHeight)
      const scrollable = Math.max(1, root.scrollHeight - root.clientHeight)
      win.style.top = `${(root.scrollTop / scrollable) * (1 - visible) * 100}%`
      win.style.height = `${visible * 100}%`
    }
    const onScroll = (): void => {
      if (frame === 0) frame = requestAnimationFrame(paint)
    }
    paint()
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      root.removeEventListener('scroll', onScroll)
      if (frame !== 0) cancelAnimationFrame(frame)
    }
  }, [feed, overlay, key])
}

/** `⌥↑`/`⌥↓` stepping, hung off the window so it works wherever focus is — except in a text field. */
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

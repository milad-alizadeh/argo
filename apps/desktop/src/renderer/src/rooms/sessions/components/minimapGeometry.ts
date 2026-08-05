import { type RefObject, useLayoutEffect, useState } from 'react'
import { ANCHOR } from './feedScroll'

// The minimap's geometry, MEASURED off the rendered feed rather than weighted from the row list.
// A weighted strip is a guess about how tall a row will be; this reads how tall it actually IS, so
// a block covers exactly the fraction of the strip its turn covers of the scroll and the viewport
// window over it lands on the same events the pane is showing. Measured on content change and on
// resize — a thought unfolding moves the column, and the strip has to follow — never on scroll.

/** One row's tick: where that row landed, as fractions of the feed's whole scroll height. */
export interface MinimapTick {
  key: string
  kind: string
  top: number
  height: number
}

/** One chapter's block: its section's measured extent, and the ticks inside it. */
export interface MinimapBlock {
  key: string
  top: number
  height: number
  ticks: readonly MinimapTick[]
}

type Extent = Pick<MinimapTick, 'top' | 'height'>
type Measure = (element: HTMLElement) => Extent

// A sticky seam mid-scroll reports its STUCK position rather than its place in the column, so it
// is the one element placed by construction: it belongs at its section's very top.
function ticksOf(section: HTMLElement, extentOf: Measure): MinimapTick[] {
  const seam = section.querySelector<HTMLElement>('[data-component="FeedSeam"]')
  const head: MinimapTick[] = seam
    ? [{ key: 'seam', kind: 'prompt', top: extentOf(section).top, height: extentOf(seam).height }]
    : []
  return head.concat(
    [...section.querySelectorAll<HTMLElement>('[data-feedrow]')].map((row, index) => ({
      key: `row-${index}`,
      kind: row.getAttribute('data-feedrow') ?? 'call',
      ...extentOf(row),
    })),
  )
}

function measure(root: HTMLElement): MinimapBlock[] {
  // Content coordinates: a rect's top moves with the scroll, so anchor it to the content origin.
  const origin = root.getBoundingClientRect().top - root.scrollTop
  const total = root.scrollHeight
  const extentOf: Measure = (element) => {
    const rect = element.getBoundingClientRect()
    return { top: (rect.top - origin) / total, height: rect.height / total }
  }
  return [...root.querySelectorAll<HTMLElement>(`[${ANCHOR}]`)].map((section) => ({
    key: section.getAttribute(ANCHOR) ?? '',
    ...extentOf(section),
    ticks: ticksOf(section, extentOf),
  }))
}

/** The measured strip. `key` is the caller's statement that the feed's content changed. */
export function useMinimapBlocks(
  feed: RefObject<HTMLElement | null>,
  key: string,
): readonly MinimapBlock[] {
  const [blocks, setBlocks] = useState<readonly MinimapBlock[]>([])
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` says the content changed; re-measuring on it is the point.
  useLayoutEffect(() => {
    const root = feed.current
    if (!root) return
    const remeasure = (): void => setBlocks(measure(root))
    remeasure()
    // The scroller for the viewport's size, every section for its own growth.
    const observer = new ResizeObserver(remeasure)
    observer.observe(root)
    for (const section of root.querySelectorAll(`[${ANCHOR}]`)) observer.observe(section)
    return () => observer.disconnect()
  }, [feed, key])
  return blocks
}

/**
 * Sizes the minimap's viewport window. Its MOTION is pure CSS — a scroll-driven animation on the
 * feed's own scroll-timeline — so nothing here listens to scroll. The one thing CSS cannot read is
 * the visible FRACTION of the feed (`clientHeight / scrollHeight`), which is measured here.
 */
export function useMinimapWindow(
  feed: RefObject<HTMLElement | null>,
  overlay: RefObject<HTMLElement | null>,
  key: string,
): void {
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` says the content changed; re-measuring on it is the point.
  useLayoutEffect(() => {
    const root = feed.current
    const win = overlay.current
    if (!root || !win) return
    const size = (): void => {
      win.style.height = `${Math.min(1, root.clientHeight / root.scrollHeight) * 100}%`
    }
    size()
    const observer = new ResizeObserver(size)
    observer.observe(root)
    for (const section of root.querySelectorAll(`[${ANCHOR}]`)) observer.observe(section)
    return () => observer.disconnect()
  }, [feed, overlay, key])
}

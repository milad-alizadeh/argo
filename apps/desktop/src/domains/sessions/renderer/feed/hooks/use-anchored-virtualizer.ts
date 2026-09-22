import { useVirtualizer } from '@tanstack/react-virtual'
import type { Virtualizer } from '@tanstack/virtual-core'
import type { ReactNode } from 'react'
import type { SessionFeedRow } from '../../types'

const FEED_ROW_ESTIMATE_PX = 96
const FEED_OVERSCAN = 8
const TAIL_THRESHOLD_PX = 80
const TAIL_KEY = 'feed-tail'

export function useAnchoredVirtualizer({
  following,
  rows,
  tail,
  viewport,
  padding,
  onChange,
}: {
  following: boolean
  rows: readonly SessionFeedRow[]
  tail: ReactNode
  viewport: HTMLElement | null
  padding: { start: number; end: number }
  onChange: (instance: Virtualizer<HTMLElement, Element>, sync: boolean) => void
}) {
  return useVirtualizer({
    anchorTo: following ? 'end' : 'start',
    count: rows.length + (tail === null ? 0 : 1),
    estimateSize: () => FEED_ROW_ESTIMATE_PX,
    // Smooth tail scrolling delays short-row measurement and leaves estimate-sized gaps (#2545).
    followOnAppend: following,
    getItemKey: (index) => (index === rows.length ? TAIL_KEY : feedRowAt(rows, index).id),
    getScrollElement: () => viewport,
    onChange,
    overscan: FEED_OVERSCAN,
    paddingStart: padding.start,
    paddingEnd: padding.end,
    scrollPaddingStart: padding.start,
    scrollEndThreshold: TAIL_THRESHOLD_PX,
  })
}

function feedRowAt(rows: readonly SessionFeedRow[], index: number) {
  const row = rows[index]
  if (row === undefined) throw new RangeError(`Feed row ${index} is outside the virtualizer range.`)
  return row
}

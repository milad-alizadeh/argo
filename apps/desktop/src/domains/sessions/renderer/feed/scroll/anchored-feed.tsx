import type { VirtualItem, Virtualizer } from '@tanstack/virtual-core'
import type { ReactNode } from 'react'
import { useLayoutEffect, useRef } from 'react'
import type { SessionFeedRow } from '../../types'
import type { Settled } from '../document/use-settled-feed'
import {
  useAnchoredVirtualizer,
  useFeedViewport,
  useInitialFeedPosition,
  useScrollPositionSnapshot,
  useTailThroughViewportResize,
} from './anchoring'
import { type FeedRowComponent, FeedViewport } from './feed-viewport'
import { useFeedPrompt, usePromptHold } from './prompt-pin'
import type { Reveal } from './reveal'
import { useFeedTailFollow, useJumpToLatest } from './tail-follow'

type AnchoredFeedProps = {
  active: boolean
  FeedRow: FeedRowComponent
  initialMeasurementsCache: VirtualItem[]
  initialScrollPosition: number | null
  onJumpToLatestChange: (sessionId: string, action: (() => void) | null) => void
  onMeasurementsChange: (sessionId: string, measurements: VirtualItem[]) => void
  onScrollPositionChange: (sessionId: string, position: number) => void
  rows: readonly SessionFeedRow[]
  settled: Settled
  reveals: ReadonlyMap<string, Reveal>
  streamingRowId: string | null
  // Markers after the last row (Working, compaction, handoff), scrolled with it clear of the composer.
  tail: ReactNode
  historyLabel: string
}

function visibleRowAnchor(viewport: HTMLElement, rows: readonly SessionFeedRow[]) {
  const view = viewport.getBoundingClientRect()
  for (const element of viewport.querySelectorAll<HTMLElement>('[data-index]')) {
    const bounds = element.getBoundingClientRect()
    if (bounds.bottom <= view.top || bounds.top >= view.bottom) continue
    const row = rows[Number(element.dataset.index)]
    if (row !== undefined) return { id: row.id, offset: bounds.top - view.top }
  }
  return null
}

function currentRowAnchor(
  viewport: HTMLElement,
  rows: readonly SessionFeedRow[],
  virtualizer: Virtualizer<HTMLElement, Element>,
) {
  const mounted = visibleRowAnchor(viewport, rows)
  if (mounted !== null) return mounted
  const measured = virtualizer.getVirtualItemForOffset(viewport.scrollTop)
  if (measured === undefined) return null
  const row = rows[measured.index]
  return row === undefined ? null : { id: row.id, offset: measured.start - viewport.scrollTop }
}

function scrollToAnchor(
  virtualizer: Virtualizer<HTMLElement, Element>,
  rows: readonly SessionFeedRow[],
  id: string,
) {
  const index = rows.findIndex((row) => row.id === id)
  if (index < 0) return false
  virtualizer.scrollToIndex(index, { align: 'start' })
  return true
}

// TanStack chat pattern: https://tanstack.com/virtual/latest/docs/chat.
export function AnchoredFeed({
  active,
  FeedRow,
  initialMeasurementsCache,
  initialScrollPosition,
  onJumpToLatestChange,
  onMeasurementsChange,
  onScrollPositionChange,
  rows,
  settled,
  reveals,
  streamingRowId,
  tail,
  historyLabel,
}: AnchoredFeedProps) {
  const { attachViewport, paddingStart, viewport } = useFeedViewport()
  const tailFollow = useFeedTailFollow(settled.reading.sessionId, { active, viewport })
  const { following, update: updatePromptHold } = usePromptHold(tailFollow.shouldFollow)
  const virtualizer = useAnchoredVirtualizer({
    following,
    initialMeasurementsCache,
    initialScrollPosition,
    rows,
    tail,
    viewport,
    paddingStart,
    onChange: tailFollow.onChange,
  })
  useTailThroughViewportResize(viewport, following)
  const visibleAnchor = useRef<{ id: string; offset: number } | null>(null)
  const pendingAnchor = useRef<{ id: string; offset: number } | null>(null)
  const committedRows = useRef(rows)
  // A first snapshot can land under live-only rows; the reader keeps their row.
  useLayoutEffect(() => {
    const firstId = committedRows.current[0]?.id
    const addedBefore = firstId === undefined ? 0 : rows.findIndex((row) => row.id === firstId)
    const preserved = visibleAnchor.current
    if (viewport !== null && addedBefore > 0 && preserved !== null) {
      if (scrollToAnchor(virtualizer, rows, preserved.id)) pendingAnchor.current = preserved
    }
    committedRows.current = rows
  }, [rows, viewport, virtualizer])
  useLayoutEffect(() => {
    const anchor = pendingAnchor.current
    if (anchor === null || viewport === null) return
    const index = rows.findIndex((row) => row.id === anchor.id)
    const element = viewport.querySelector<HTMLElement>(`[data-index="${index}"]`)
    if (element === null) return
    const offset = element.getBoundingClientRect().top - viewport.getBoundingClientRect().top
    if (Math.abs(offset - anchor.offset) > 0.5)
      virtualizer.scrollToOffset(viewport.scrollTop + offset - anchor.offset)
    pendingAnchor.current = null
  })
  useLayoutEffect(() => {
    if (viewport === null) return
    const anchor = visibleRowAnchor(viewport, rows)
    if (anchor !== null) visibleAnchor.current = anchor
  })
  useLayoutEffect(() => {
    if (viewport === null) return
    let frame: number | null = null
    const rememberAnchor = () => {
      const anchor = currentRowAnchor(viewport, rows, virtualizer)
      // Keep this scroll even if a prepend cancels the next frame.
      if (anchor !== null) visibleAnchor.current = anchor
      if (frame !== null) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const settledAnchor = visibleRowAnchor(viewport, rows)
        if (settledAnchor !== null) visibleAnchor.current = settledAnchor
        frame = null
      })
    }
    viewport.addEventListener('scroll', rememberAnchor, { passive: true })
    return () => {
      viewport.removeEventListener('scroll', rememberAnchor)
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [rows, viewport, virtualizer])
  useInitialFeedPosition({
    initialScrollPosition,
    onPositioned: tailFollow.markInitiallyPositioned,
    sessionId: settled.reading.sessionId,
    viewport,
    virtualizer,
  })
  useScrollPositionSnapshot(
    settled.reading.sessionId,
    viewport,
    virtualizer,
    onScrollPositionChange,
    onMeasurementsChange,
  )
  const promptIndex = useFeedPrompt({
    positioned: !tailFollow.awaitingInitialPosition,
    rows,
    sessionId: settled.reading.sessionId,
    virtualizer,
    updatePromptHold,
    paddingStart,
  })
  useJumpToLatest({
    active,
    onJumpToLatestChange,
    sessionId: settled.reading.sessionId,
    tailFollow,
    virtualizer,
    viewport,
  })

  return (
    <div className="feed__scroller">
      <FeedViewport
        FeedRow={FeedRow}
        gap={paddingStart}
        promptIndex={promptIndex}
        reveals={reveals}
        rows={rows}
        setViewport={attachViewport}
        settled={settled}
        streamingRowId={streamingRowId}
        tail={tail}
        historyLabel={historyLabel}
        virtualizer={virtualizer}
      />
    </div>
  )
}

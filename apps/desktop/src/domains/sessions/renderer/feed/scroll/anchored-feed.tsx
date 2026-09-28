import type { VirtualItem } from '@tanstack/virtual-core'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/platform/renderer/components/ui/button'
import type { SessionFeedRow } from '../../types'
import type { Settled } from '../document/use-settled-feed'
import {
  useAnchoredVirtualizer,
  useFeedViewport,
  useInitialFeedPosition,
  useScrollPositionSnapshot,
} from './anchoring'
import { type FeedRowComponent, FeedViewport } from './feed-viewport'
import { useFeedPrompt, usePromptHold } from './prompt-pin'
import type { Reveal } from './reveal'
import { useFeedTailFollow, useJumpToLatest } from './tail-follow'

type AnchoredFeedProps = {
  active: boolean
  hasOlder?: boolean
  loadingOlder?: boolean
  olderError?: boolean
  onLoadOlder?: () => void
  FeedRow: FeedRowComponent
  initialMeasurementsCache: VirtualItem[]
  initialScrollPosition: number | null
  onJumpToLatestChange: (sessionId: string, action: (() => void) | null) => void
  onMeasurementsChange: (sessionId: string, measurements: VirtualItem[]) => void
  onScrollPositionChange: (sessionId: string, position: number) => void
  rows: readonly SessionFeedRow[]
  settled: Settled
  revealsFor: (settled: Settled) => ReadonlyMap<string, Reveal>
  streamingRowId: string | null
  // Markers after the last row (Working, compaction, handoff), scrolled with it clear of the composer.
  tail: ReactNode
  historyLabel: string
}

// TanStack chat pattern: https://tanstack.com/virtual/latest/docs/chat.
export function AnchoredFeed({
  active,
  hasOlder = false,
  loadingOlder = false,
  olderError = false,
  onLoadOlder,
  FeedRow,
  initialMeasurementsCache,
  initialScrollPosition,
  onJumpToLatestChange,
  onMeasurementsChange,
  onScrollPositionChange,
  rows,
  settled,
  revealsFor,
  streamingRowId,
  tail,
  historyLabel,
}: AnchoredFeedProps) {
  const { t } = useTranslation('sessions')
  const { attachViewport, padding, viewport } = useFeedViewport()
  const tailFollow = useFeedTailFollow(settled.reading.sessionId, { active, viewport })
  const { following, update: updatePromptHold } = usePromptHold(tailFollow.shouldFollow)
  const virtualizer = useAnchoredVirtualizer({
    following,
    initialMeasurementsCache,
    initialScrollPosition,
    rows,
    tail,
    viewport,
    padding,
    onChange: tailFollow.onChange,
  })
  const olderAnchor = useRef<{ id: string; offset: number; count: number } | null>(null)
  const startOlderLoad = useCallback(() => {
    if (onLoadOlder === undefined || olderAnchor.current !== null) return
    if (viewport === null) {
      onLoadOlder()
      return
    }
    const firstVisible = virtualizer
      .getVirtualItems()
      .find((item) => item.end > viewport.scrollTop && rows[item.index] !== undefined)
    if (firstVisible === undefined) {
      onLoadOlder()
      return
    }
    const row = rows[firstVisible.index]
    if (row === undefined) return
    olderAnchor.current = {
      id: row.id,
      offset: firstVisible.start - viewport.scrollTop,
      count: rows.length,
    }
    onLoadOlder()
  }, [onLoadOlder, rows, viewport, virtualizer])
  useLayoutEffect(() => {
    const anchor = olderAnchor.current
    if (anchor === null || viewport === null || rows.length <= anchor.count) return
    const index = rows.findIndex((row) => row.id === anchor.id)
    const start = virtualizer.measurementsCache[index]?.start
    if (start !== undefined) viewport.scrollTop = Math.max(0, start - anchor.offset)
    olderAnchor.current = null
  }, [rows, viewport, virtualizer])
  useEffect(() => {
    if (olderError) olderAnchor.current = null
  }, [olderError])
  useEffect(() => {
    if (
      !active ||
      !hasOlder ||
      loadingOlder ||
      tailFollow.awaitingInitialPosition ||
      viewport === null ||
      onLoadOlder === undefined
    )
      return
    const loadAtTop = () => {
      if (viewport.scrollTop <= 160) startOlderLoad()
    }
    viewport.addEventListener('scroll', loadAtTop, { passive: true })
    loadAtTop()
    return () => viewport.removeEventListener('scroll', loadAtTop)
  }, [
    active,
    hasOlder,
    loadingOlder,
    onLoadOlder,
    startOlderLoad,
    tailFollow.awaitingInitialPosition,
    viewport,
  ])
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
    paddingStart: padding.start,
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
      {olderError && onLoadOlder !== undefined ? (
        <Button
          className="absolute left-1/2 top-(--spacing-tight) z-10 -translate-x-1/2"
          onClick={startOlderLoad}
          type="button"
          variant="outline"
        >
          {t('retryOlderHistory')}
        </Button>
      ) : null}
      <FeedViewport
        FeedRow={FeedRow}
        gap={padding.start}
        promptIndex={promptIndex}
        reveals={revealsFor(settled)}
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

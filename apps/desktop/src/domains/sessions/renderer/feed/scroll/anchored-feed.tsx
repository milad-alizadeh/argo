import type { VirtualItem } from '@tanstack/virtual-core'
import type { ReactNode } from 'react'
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
  })

  return (
    <div className="feed__scroller">
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

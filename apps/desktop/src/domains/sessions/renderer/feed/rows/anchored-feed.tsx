import type { ReactNode } from 'react'
import type { SessionFeedRow } from '../../types'
import type { Settled } from '../hooks'
import {
  useAnchoredVirtualizer,
  useFeedPrompt,
  useFeedTailFollow,
  useFeedViewport,
  useInitialFeedPosition,
  useJumpToLatest,
  usePromptHold,
  useScrollPositionSnapshot,
} from '../hooks'
import { type FeedRowComponent, FeedViewport } from './feed-viewport'
import type { Reveal } from './reveal'

type AnchoredFeedProps = {
  active: boolean
  FeedRow: FeedRowComponent
  initialScrollPosition: number | null
  onJumpToLatestChange: (sessionId: string, action: (() => void) | null) => void
  onScrollPositionChange: (sessionId: string, position: number) => void
  rows: readonly SessionFeedRow[]
  settled: Settled
  revealsFor: (settled: Settled) => ReadonlyMap<string, Reveal>
  streamingRowId: string | null
  // Markers after the last row (Working, compaction, handoff), scrolled with it clear of the composer.
  tail: ReactNode
}

// TanStack chat pattern: https://tanstack.com/virtual/latest/docs/chat.
export function AnchoredFeed({
  active,
  FeedRow,
  initialScrollPosition,
  onJumpToLatestChange,
  onScrollPositionChange,
  rows,
  settled,
  revealsFor,
  streamingRowId,
  tail,
}: AnchoredFeedProps) {
  const { attachViewport, padding, viewport } = useFeedViewport()
  const tailFollow = useFeedTailFollow(settled.reading.sessionId, { active, viewport })
  const { following, update: updatePromptHold } = usePromptHold(tailFollow.shouldFollow)
  const virtualizer = useAnchoredVirtualizer({
    following,
    rows,
    tail,
    viewport,
    padding,
    onChange: tailFollow.onChange,
  })
  useInitialFeedPosition({
    active,
    following: tailFollow.atLatest,
    initialScrollPosition,
    onPositioned: tailFollow.markInitiallyPositioned,
    sessionId: settled.reading.sessionId,
    viewport,
    virtualizer,
  })
  useScrollPositionSnapshot(settled.reading.sessionId, viewport, onScrollPositionChange)
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
        virtualizer={virtualizer}
      />
    </div>
  )
}

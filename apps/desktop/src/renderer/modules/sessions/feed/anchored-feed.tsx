import { useVirtualizer } from '@tanstack/react-virtual'
import type { ReactNode } from 'react'
import type { SessionFeedRow } from '../types'
import { type FeedRowComponent, FeedViewport } from './feed-viewport'
import type { Reveal } from './reveal'
import { useFeedTailFollow } from './use-feed-tail-follow'
import { useFeedViewport } from './use-feed-viewport'
import { useInitialFeedPosition } from './use-initial-feed-position'
import { useJumpToLatest } from './use-jump-to-latest'
import { usePromptAtTop, usePromptHold } from './use-prompt-at-top'
import type { Settled } from './use-settled-feed'

type AnchoredFeedProps = {
  active: boolean
  FeedRow: FeedRowComponent
  onJumpToLatestChange: (sessionId: string, action: (() => void) | null) => void
  rows: readonly SessionFeedRow[]
  settled: Settled
  revealsFor: (settled: Settled) => ReadonlyMap<string, Reveal>
  streamingRowId: string | null
  // Markers after the last row (Working, compaction, handoff), scrolled with it clear of the composer.
  tail: ReactNode
}

const FEED_ROW_ESTIMATE_PX = 96
const FEED_OVERSCAN = 8
const TAIL_THRESHOLD_PX = 80
const TAIL_KEY = 'feed-tail'

// TanStack chat pattern: https://tanstack.com/virtual/latest/docs/chat.
export function AnchoredFeed({
  active,
  FeedRow,
  onJumpToLatestChange,
  rows,
  settled,
  revealsFor,
  streamingRowId,
  tail,
}: AnchoredFeedProps) {
  const { attachViewport, padding, viewport } = useFeedViewport()
  const tailFollow = useFeedTailFollow(settled.reading.sessionId, { active, viewport })
  const { following, update: updatePromptHold } = usePromptHold(tailFollow.shouldFollow)
  const virtualizer = useVirtualizer({
    // End anchoring is only correct while the reader is following the tail.
    // While they are reading history, retain their actual reading position as
    // rows append instead of resolving the previous end anchor.
    anchorTo: following ? 'end' : 'start',
    count: rows.length + (tail === null ? 0 : 1),
    estimateSize: () => FEED_ROW_ESTIMATE_PX,
    // Only follow an append while the reader is already at the tail. Keeping
    // this enabled while they are inspecting history makes a streamed row pull
    // them back to the end before the Jump to latest control can be used.
    followOnAppend: following ? 'smooth' : false,
    getItemKey: (index) => (index === rows.length ? TAIL_KEY : feedRowAt(rows, index).id),
    getScrollElement: () => viewport,
    onChange: tailFollow.onChange,
    overscan: FEED_OVERSCAN,
    paddingStart: padding.start,
    paddingEnd: padding.end,
    scrollPaddingStart: padding.start,
    scrollEndThreshold: TAIL_THRESHOLD_PX,
  })
  useInitialFeedPosition({
    active,
    following: tailFollow.atLatest,
    onPositioned: tailFollow.markInitiallyPositioned,
    sessionId: settled.reading.sessionId,
    viewport,
    virtualizer,
  })
  const promptIndex = usePromptAtTop({
    positioned: !tailFollow.awaitingInitialPosition,
    rows,
    sessionId: settled.reading.sessionId,
    virtualizer,
  })
  updatePromptHold(virtualizer, promptIndex, padding.start)
  const reveals = revealsFor(settled)
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
        reveals={reveals}
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

function feedRowAt(rows: readonly SessionFeedRow[], index: number) {
  const row = rows[index]
  if (row === undefined) throw new RangeError(`Feed row ${index} is outside the virtualizer range.`)
  return row
}

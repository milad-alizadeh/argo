import { type ReactVirtualizer, useVirtualizer } from '@tanstack/react-virtual'
import { type ReactNode, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { SessionFeedRow } from '../types'
import type { Reveal } from './reveal'
import { useFeedTailFollow } from './use-feed-tail-follow'
import { useFeedViewport } from './use-feed-viewport'
import { useInitialFeedPosition } from './use-initial-feed-position'
import type { Settled } from './useSettledFeed'

type FeedRowComponent = (props: { row: SessionFeedRow; reveal?: Reveal }) => ReactNode
type AnchoredFeedProps = {
  active: boolean
  FeedRow: FeedRowComponent
  onJumpToLatestChange: (sessionId: string, action: (() => void) | null) => void
  rows: readonly SessionFeedRow[]
  settled: Settled
  revealsFor: (settled: Settled) => ReadonlyMap<string, Reveal>
}
type FeedViewportProps = Pick<AnchoredFeedProps, 'FeedRow' | 'rows' | 'settled'> & {
  reveals: ReadonlyMap<string, Reveal>
  setViewport: (viewport: HTMLElement | null) => void
  virtualizer: ReactVirtualizer<HTMLElement, Element>
}

const FEED_ROW_ESTIMATE_PX = 96
const FEED_OVERSCAN = 8
const TAIL_THRESHOLD_PX = 80

// TanStack chat pattern: https://tanstack.com/virtual/latest/docs/chat.
export function AnchoredFeed({
  active,
  FeedRow,
  onJumpToLatestChange,
  rows,
  settled,
  revealsFor,
}: AnchoredFeedProps) {
  const { attachViewport, padding, viewport } = useFeedViewport()
  const tailFollow = useFeedTailFollow(settled.reading.sessionId)
  const virtualizer = useVirtualizer({
    // End anchoring is only correct while the reader is following the tail.
    // While they are reading history, retain their actual reading position as
    // rows append instead of resolving the previous end anchor.
    anchorTo: tailFollow.shouldFollow ? 'end' : 'start',
    count: rows.length,
    estimateSize: () => FEED_ROW_ESTIMATE_PX,
    // Only follow an append while the reader is already at the tail. Keeping
    // this enabled while they are inspecting history makes a streamed row pull
    // them back to the end before the Jump to latest control can be used.
    followOnAppend: tailFollow.shouldFollow ? 'smooth' : false,
    getItemKey: (index) => feedRowAt(rows, index).id,
    getScrollElement: () => viewport,
    onChange: tailFollow.onChange,
    overscan: FEED_OVERSCAN,
    paddingStart: padding.start,
    paddingEnd: padding.end,
    scrollEndThreshold: TAIL_THRESHOLD_PX,
  })
  useInitialFeedPosition({
    onPositioned: tailFollow.markInitiallyPositioned,
    sessionId: settled.reading.sessionId,
    viewport,
    virtualizer,
  })
  const reveals = revealsFor(settled)
  const jumpToLatest = useCallback(() => {
    virtualizer.scrollToEnd({ behavior: 'smooth' })
  }, [virtualizer])
  useEffect(() => {
    onJumpToLatestChange(
      settled.reading.sessionId,
      active && !tailFollow.awaitingInitialPosition && !tailFollow.atLatest ? jumpToLatest : null,
    )
    return () => onJumpToLatestChange(settled.reading.sessionId, null)
  }, [
    active,
    jumpToLatest,
    onJumpToLatestChange,
    settled.reading.sessionId,
    tailFollow.atLatest,
    tailFollow.awaitingInitialPosition,
  ])

  return (
    <div className="feed__scroller">
      <FeedViewport
        FeedRow={FeedRow}
        reveals={reveals}
        rows={rows}
        setViewport={attachViewport}
        settled={settled}
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

function FeedViewport({
  FeedRow,
  reveals,
  rows,
  settled,
  setViewport,
  virtualizer,
}: FeedViewportProps) {
  const { t } = useTranslation('sessions')
  return (
    <section
      aria-label={t('historyLabel')}
      className="feed__viewport"
      data-reading-revision={settled.reading.revision}
      data-session={settled.reading.sessionId}
      ref={setViewport}
    >
      <div className="feed__content" style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((item) => {
          const row = rows[item.index]
          if (row === undefined) return null
          return (
            <div
              data-index={item.index}
              key={item.key}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                transform: `translateY(${item.start}px)`,
                width: '100%',
              }}
            >
              <FeedRow reveal={reveals.get(row.id)} row={row} />
            </div>
          )
        })}
      </div>
    </section>
  )
}

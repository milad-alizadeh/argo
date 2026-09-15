import { type ReactVirtualizer, useVirtualizer } from '@tanstack/react-virtual'
import { type ReactNode, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SessionFeedRow } from '../types'
import { FeedJumpToLatest } from './FeedJumpToLatest'
import type { Reveal } from './reveal'
import { useInitialFeedPosition } from './use-initial-feed-position'
import type { Settled } from './useSettledFeed'

type FeedRowComponent = (props: { row: SessionFeedRow; reveal?: Reveal }) => ReactNode
type AnchoredFeedProps = {
  FeedRow: FeedRowComponent
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
export function AnchoredFeed({ FeedRow, rows, settled, revealsFor }: AnchoredFeedProps) {
  const { t } = useTranslation('sessions')
  const [atLatest, setAtLatest] = useState(true)
  const [viewport, setViewport] = useState<HTMLElement | null>(null)
  const [padding, setPadding] = useState({ start: 0, end: 0 })
  const attachViewport = useCallback((element: HTMLElement | null) => {
    if (element !== null) {
      const style = getComputedStyle(element)
      setPadding({
        start: Number.parseFloat(style.scrollPaddingTop) || 0,
        end: Number.parseFloat(style.scrollPaddingBottom) || 0,
      })
    }
    setViewport(element)
  }, [])
  const virtualizer = useVirtualizer({
    anchorTo: 'end',
    count: rows.length,
    estimateSize: () => FEED_ROW_ESTIMATE_PX,
    followOnAppend: 'smooth',
    getItemKey: (index) => feedRowAt(rows, index).id,
    getScrollElement: () => viewport,
    onChange: (instance) => {
      setAtLatest((current) => {
        const next = instance.isAtEnd(TAIL_THRESHOLD_PX)
        return current === next ? current : next
      })
    },
    overscan: FEED_OVERSCAN,
    paddingStart: padding.start,
    paddingEnd: padding.end,
    scrollEndThreshold: TAIL_THRESHOLD_PX,
  })
  useInitialFeedPosition({
    sessionId: settled.reading.sessionId,
    viewport,
    virtualizer,
  })
  const reveals = revealsFor(settled)

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
      {atLatest ? null : (
        <FeedJumpToLatest
          label={t('jumpToLatest')}
          onClick={() => virtualizer.scrollToEnd({ behavior: 'smooth' })}
        />
      )}
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

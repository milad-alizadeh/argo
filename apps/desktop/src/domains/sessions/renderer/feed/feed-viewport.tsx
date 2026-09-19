import type { ReactVirtualizer } from '@tanstack/react-virtual'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Reveal } from '@/domains/sessions/renderer/feed/reveal'
import { feedContentHeight } from '@/domains/sessions/renderer/feed/use-prompt-at-top'
import type { Settled } from '@/domains/sessions/renderer/feed/use-settled-feed'
import type { SessionFeedRow } from '@/domains/sessions/renderer/types'

export type FeedRowComponent = (props: {
  row: SessionFeedRow
  reveal?: Reveal
  streaming?: boolean
}) => ReactNode

type FeedViewportProps = {
  FeedRow: FeedRowComponent
  gap: number
  promptIndex: number | null
  reveals: ReadonlyMap<string, Reveal>
  rows: readonly SessionFeedRow[]
  settled: Settled
  setViewport: (viewport: HTMLElement | null) => void
  streamingRowId: string | null
  tail: ReactNode
  virtualizer: ReactVirtualizer<HTMLElement, Element>
}

// The item one past the last row holds the tail markers.
export function FeedViewport({
  FeedRow,
  gap,
  promptIndex,
  reveals,
  rows,
  settled,
  setViewport,
  streamingRowId,
  tail,
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
      <div
        className="feed__content"
        style={{ height: `${feedContentHeight(virtualizer, promptIndex, gap)}px` }}
      >
        {virtualizer.getVirtualItems().map((item) => {
          const row = rows[item.index]
          if (row === undefined && item.index !== rows.length) return null
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
              {row === undefined ? (
                <div className="feed-row">{tail}</div>
              ) : (
                <FeedRow
                  reveal={reveals.get(row.id)}
                  row={row}
                  streaming={row.id === streamingRowId}
                />
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

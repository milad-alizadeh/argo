import type { ReactVirtualizer } from '@tanstack/react-virtual'
import { type ReactNode, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { SessionFeedRow } from '@/domains/sessions/renderer/types'
import type { Reveal } from './reveal'
import { feedContentHeight } from './use-prompt-at-top'
import type { Settled } from './use-settled-feed'

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
  // A scrollable region needs its own tab stop so keyboard-only reading (arrow keys, Page Up/Down)
  // reaches it even before any row inside becomes focusable (#2623: scrollable-region-focusable).
  // Set by hand on the node rather than a `tabIndex` prop: biome's `noNoninteractiveTabindex`
  // flatly rejects a positive `tabIndex` on a native `section`, with no role-based exception.
  // Memoized so its identity is stable across renders: a fresh function every render would make
  // React detach and reattach the ref (and re-run `setViewport`) on every commit.
  const setScrollableViewport = useCallback(
    (node: HTMLElement | null) => {
      if (node) node.tabIndex = 0
      setViewport(node)
    },
    [setViewport],
  )
  return (
    <section
      aria-label={t('historyLabel')}
      className="feed__viewport"
      data-reading-revision={settled.reading.revision}
      data-session={settled.reading.sessionId}
      ref={setScrollableViewport}
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

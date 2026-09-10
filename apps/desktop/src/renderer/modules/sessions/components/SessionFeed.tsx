import { useTranslation } from 'react-i18next'

import '../feed/feed.css'
import { MessageScroller } from '../feed/scroller'
import { type Settled, useSettledFeed } from '../feed/useSettledFeed'
import type { SessionFeed as SessionFeedData, SessionFeedRow as SessionFeedRowData } from '../types'
import { FeedEmpty } from './FeedEmpty'
import { SessionActivityIndicator } from './SessionActivityIndicator'
import { SessionFeedRow } from './SessionFeedRow'

type SessionFeedProps = {
  /** The reading for the selected Session, or null while there is nothing settled to draw. */
  feed: SessionFeedData | null
  /** Whether a Session is selected at all, so a Feed with no reading can tell "being read" from
      "nothing to read". */
  selected: boolean
  /** Why the selected Session's history could not be read, when it could not. */
  failure: string | null
}

// What stands in the Feed's place while no settled history can be drawn. A read or a measure pass
// in progress and a read that failed are one status Marker in the first row's place; nothing
// selected is an empty pane.
function Standing({ selected, failure }: Omit<SessionFeedProps, 'feed'>) {
  const { t } = useTranslation()
  if (failure !== null) return <SessionActivityIndicator busy={false} label={failure} />
  if (!selected) return <FeedEmpty reason="unselected" />
  return <SessionActivityIndicator busy label={t('reading')} />
}

export function SessionFeed({ feed, selected, failure }: SessionFeedProps) {
  const { t } = useTranslation()
  const sessionId = feed?.sessionId ?? null
  const rows = feed?.rows ?? []
  const { column, measured, settled } = useSettledFeed(sessionId, rows)
  const ready = settled !== null && sessionId !== null

  return (
    // The two numbers of the measure pass, written where a proof and a reader can both see them:
    // `data-measure-ms` is the pass itself, `data-settle-ms` what the reader waited for it. A
    // cached reading is 0 for both, because the pass did not run again (#1863).
    <section
      aria-label={t('feedLabel')}
      className="feed"
      data-measure-ms={settled?.measuredMs}
      data-settle-ms={settled?.settledMs}
    >
      <div className="feed__column" ref={column}>
        {/* The measurement container of rule 3. It is `content-visibility: hidden`, so it costs
            no paint and measures 0 px itself while every row inside keeps its real height. No row
            here is given a height: these are the rows the heights are read FROM. */}
        <div aria-hidden="true" className="feed__measured" ref={measured}>
          {rows.map((row) => (
            <SessionFeedRow key={row.id} row={row} />
          ))}
        </div>
        {ready && rows.length === 0 ? <FeedEmpty reason="blank" /> : null}
        {ready && rows.length > 0 ? (
          <ShownFeed rows={rows} sessionId={sessionId} settled={settled} />
        ) : null}
        {ready ? null : <Standing failure={failure} selected={selected} />}
      </div>
    </section>
  )
}

// Argo owns every height (ADR-0033 · Consequences): each row is drawn at the height the pass read
// for it, so the geometry the Feed shows is the geometry that was settled rather than a second
// layout Blink happened to arrive at. The width is written on in pixels for the same reason —
// rule 6 freezes the Feed at its settled width until the next pass lands, so a drag clips instead
// of reflowing rows whose heights were measured somewhere else.
function ShownFeed({
  rows,
  sessionId,
  settled,
}: {
  rows: readonly SessionFeedRowData[]
  sessionId: string
  settled: Settled
}) {
  const { t } = useTranslation()

  return (
    <MessageScroller.Provider defaultScrollPosition="end">
      <MessageScroller.Root className="feed__scroller">
        <MessageScroller.Viewport
          aria-label={t('historyLabel')}
          className="feed__viewport"
          data-session={sessionId}
          tabIndex={0}
        >
          <MessageScroller.Content
            className="feed__content"
            style={{ width: `${settled.reading.width}px` }}
          >
            {rows.map((row) => (
              <MessageScroller.Item key={row.id} messageId={row.id}>
                <SessionFeedRow height={settled.heights.get(row.id) ?? null} row={row} />
              </MessageScroller.Item>
            ))}
          </MessageScroller.Content>
        </MessageScroller.Viewport>
      </MessageScroller.Root>
    </MessageScroller.Provider>
  )
}

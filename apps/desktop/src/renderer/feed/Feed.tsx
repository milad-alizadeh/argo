import type { FeedRow } from '../../sessions/feed'
import './feed.css'
import { FeedRowBody } from './FeedRow'
import { Indicator } from './Indicator'
import { MessageScroller } from './scroller'
import { type Settled, useSettledFeed } from './useSettledFeed'

export type FeedProps = {
  sessionId: string | null
  rows: FeedRow[]
  // What the Feed says while it has nothing to draw, in the reader's words rather than a spinner
  // with no sentence beside it.
  standing: string | null
}

export function Feed({ sessionId, rows, standing }: FeedProps) {
  const { column, measured, settled } = useSettledFeed(sessionId, rows)
  const ready = settled !== null && sessionId !== null

  return (
    // The two numbers of the measure pass, written where a proof and a reader can both see them:
    // `data-measure-ms` is the pass itself, `data-settle-ms` what the reader waited for it. A
    // cached reading is 0 for both, because the pass did not run again (#1863).
    <section
      className="feed"
      aria-label="Session Feed"
      data-measure-ms={settled?.measuredMs}
      data-settle-ms={settled?.settledMs}
    >
      <div className="feed__column" ref={column}>
        {/* The measurement container of rule 3. It is `content-visibility: hidden`, so it costs
            no paint and measures 0 px itself while every row inside keeps its real height. No row
            here is given a height: these are the rows the heights are read FROM. */}
        <div className="feed__measured" aria-hidden="true" ref={measured}>
          {rows.map((row) => (
            <FeedRowBody key={row.id} row={row} />
          ))}
        </div>
        {ready ? (
          <ShownFeed rows={rows} sessionId={sessionId} settled={settled} />
        ) : (
          <Indicator
            standing={standing ?? 'Argo has not read this Session yet.'}
            busy={sessionId !== null}
          />
        )}
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
  rows: FeedRow[]
  sessionId: string
  settled: Settled
}) {
  return (
    <MessageScroller.Provider defaultScrollPosition="end">
      <MessageScroller.Root className="feed__scroller">
        <MessageScroller.Viewport
          className="feed__viewport"
          aria-label="Session history"
          tabIndex={0}
          data-session={sessionId}
        >
          <MessageScroller.Content
            className="feed__content"
            style={{ width: `${settled.reading.width}px` }}
          >
            {rows.map((row) => (
              <MessageScroller.Item key={row.id} messageId={row.id}>
                <FeedRowBody row={row} height={settled.heights.get(row.id) ?? null} />
              </MessageScroller.Item>
            ))}
          </MessageScroller.Content>
        </MessageScroller.Viewport>
      </MessageScroller.Root>
    </MessageScroller.Provider>
  )
}

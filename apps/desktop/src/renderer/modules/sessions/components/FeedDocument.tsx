import { Component, createRef } from 'react'
import { useTranslation } from 'react-i18next'

import { MessageScroller } from '../feed/scroller'
import { type Settled, useSettledFeed } from '../feed/useSettledFeed'
import type { SessionFeed, SessionFeedRow } from '../types'
import { FeedEmpty } from './FeedEmpty'
import { SessionFeedRow as SessionFeedRowView } from './SessionFeedRow'

type FeedDocumentProps = { active: boolean; feed: SessionFeed }

// A kept document stays mounted, with its own scroller, while another Session is chosen.
// `content-visibility` hides paint without destroying its DOM boxes (ADR-0033 rule 4).
export function FeedDocument({ active, feed }: FeedDocumentProps) {
  const { column, measured, settled } = useSettledFeed({
    active,
    sessionId: feed.sessionId,
    revision: feed.revision,
    rows: feed.rows,
  })
  const ready = settled !== null

  return (
    <div
      className="feed__document"
      data-active={active}
      data-measure-ms={settled?.measuredMs}
      data-revision={settled?.reading.revision}
      data-settle-ms={settled?.settledMs}
      inert={!active}
    >
      <div className="feed__column" ref={column}>
        <div aria-hidden="true" className="feed__measured" ref={measured}>
          {feed.rows.map((row) => (
            <SessionFeedRowView key={row.id} row={row} />
          ))}
        </div>
        {ready && settled.rows.length === 0 ? <FeedEmpty reason="blank" /> : null}
        {ready && settled.rows.length > 0 ? (
          <ShownFeed active={active} rows={settled.rows} settled={settled} />
        ) : null}
      </div>
    </div>
  )
}

// Every shown row takes the precise height Blink read in the measurement pass. The document stays
// at that width until a settled replacement arrives, so a resize clips instead of rewrapping rows
// against measurements taken at another width (ADR-0033 rule 6).
function ShownFeed({ active, rows, settled }: Omit<AnchoredFeedProps, 'historyLabel'>) {
  const { t } = useTranslation()
  return (
    <AnchoredFeed active={active} historyLabel={t('historyLabel')} rows={rows} settled={settled} />
  )
}

type AnchoredFeedProps = {
  active: boolean
  historyLabel: string
  rows: readonly SessionFeedRow[]
  settled: Settled
}

type Anchor = { element: HTMLElement; offset: number; atTail: boolean }
type Snapshot = { anchor?: Anchor; scrollTop?: number }

type AnchoredFeedState = Pick<AnchoredFeedProps, 'rows' | 'settled'>

const SCROLLING_SETTLE_MS = 180

// Rule 5 assigns live-update arithmetic to Argo. React's pre-update snapshot is the one lifecycle
// that reads the previous DOM before React replaces a settled document; the follow-up writes the
// corresponding scroll offset after Blink lays out the replacement.
class AnchoredFeed extends Component<AnchoredFeedProps> {
  viewport = createRef<HTMLDivElement>()
  heldScrollTop: number | null = null
  scrolling = false
  scrollingTimer: number | null = null
  state: AnchoredFeedState = { rows: this.props.rows, settled: this.props.settled }

  getSnapshotBeforeUpdate(
    previousProps: AnchoredFeedProps,
    previous: AnchoredFeedState,
  ): Snapshot | null {
    const viewport = this.viewport.current
    if (previousProps.active && !this.props.active && viewport !== null) {
      return { scrollTop: viewport.scrollTop }
    }
    if (readingKey(previous.settled) === readingKey(this.state.settled)) return null
    if (viewport === null) return null
    const row = [...viewport.querySelectorAll<HTMLElement>('[data-feed-row]')].find(
      (candidate) =>
        candidate.getBoundingClientRect().bottom > viewport.getBoundingClientRect().top,
    )
    if (row === undefined) return null
    return {
      anchor: {
        element: row,
        offset: row.getBoundingClientRect().top - viewport.getBoundingClientRect().top,
        atTail: viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop <= 1,
      },
    }
  }

  componentDidUpdate(
    previous: AnchoredFeedProps,
    _state: AnchoredFeedState,
    snapshot: Snapshot | null,
  ) {
    if (snapshot?.scrollTop !== undefined) {
      this.heldScrollTop = snapshot.scrollTop
      return
    }
    if (!previous.active && this.props.active && this.heldScrollTop !== null) {
      const viewport = this.viewport.current
      if (viewport !== null) viewport.scrollTop = this.heldScrollTop
    }
    if (readingKey(previous.settled) !== readingKey(this.props.settled)) {
      // A reader's motion wins. The settled replacement waits off-screen until the motion ends,
      // then starts with a fresh snapshot rather than applying this now-stale anchor.
      if (!this.scrolling) this.setState({ rows: this.props.rows, settled: this.props.settled })
      return
    }
    if (snapshot?.anchor !== undefined) this.restore(snapshot.anchor)
  }

  componentWillUnmount() {
    if (this.scrollingTimer !== null) window.clearTimeout(this.scrollingTimer)
  }

  restore(anchor: Anchor) {
    const viewport = this.viewport.current
    if (viewport === null) return
    if (anchor.atTail) viewport.scrollTop = viewport.scrollHeight
    else if (anchor.element.isConnected) {
      viewport.scrollTop +=
        anchor.element.getBoundingClientRect().top -
        viewport.getBoundingClientRect().top -
        anchor.offset
    }
  }

  markReaderScrolling = () => {
    this.scrolling = true
    if (this.scrollingTimer !== null) window.clearTimeout(this.scrollingTimer)
    this.scrollingTimer = window.setTimeout(() => {
      this.scrolling = false
      if (readingKey(this.state.settled) !== readingKey(this.props.settled)) {
        this.setState({ rows: this.props.rows, settled: this.props.settled })
      }
    }, SCROLLING_SETTLE_MS)
  }

  render() {
    const { historyLabel } = this.props
    const { rows, settled } = this.state
    return (
      <MessageScroller.Provider autoScroll defaultScrollPosition="end">
        <MessageScroller.Root className="feed__scroller">
          <MessageScroller.Viewport
            aria-label={historyLabel}
            className="feed__viewport"
            data-reading-revision={settled.reading.revision}
            data-session={settled.reading.sessionId}
            onWheel={this.markReaderScrolling}
            ref={this.viewport}
            tabIndex={0}
          >
            <MessageScroller.Content
              className="feed__content"
              style={{ width: `${settled.reading.width}px` }}
            >
              {rows.map((row) => (
                <MessageScroller.Item key={row.id} messageId={row.id}>
                  <SessionFeedRowView height={settled.heights.get(row.id) ?? null} row={row} />
                </MessageScroller.Item>
              ))}
            </MessageScroller.Content>
          </MessageScroller.Viewport>
        </MessageScroller.Root>
      </MessageScroller.Provider>
    )
  }
}

function readingKey(settled: Settled) {
  return JSON.stringify(settled.reading)
}

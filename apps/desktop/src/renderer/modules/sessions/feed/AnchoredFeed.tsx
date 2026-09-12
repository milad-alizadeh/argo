import { Component, createRef, type ReactNode } from 'react'
import type { SessionFeedRow } from '../types'
import { MessageScroller } from './scroller'
import type { Settled } from './useSettledFeed'

type Anchor = { element: HTMLElement; offset: number; atTail: boolean }
type FeedRowComponent = (props: { row: SessionFeedRow; height?: number }) => ReactNode
type AnchoredFeedProps = {
  FeedRow: FeedRowComponent
  rows: readonly SessionFeedRow[]
  settled: Settled
}
type AnchoredFeedState = Pick<AnchoredFeedProps, 'rows' | 'settled'>

const SCROLLING_SETTLE_MS = 180

// React's pre-update snapshot reads the old document before a settled replacement changes its
// layout, then restores either the tail or the first visible row after that replacement (#1834).
export class AnchoredFeed extends Component<AnchoredFeedProps, AnchoredFeedState> {
  viewport = createRef<HTMLDivElement>()
  scrolling = false
  scrollingTimer: number | null = null
  state: AnchoredFeedState = { rows: this.props.rows, settled: this.props.settled }

  getSnapshotBeforeUpdate(
    _previous: AnchoredFeedProps,
    previous: AnchoredFeedState,
  ): Anchor | null {
    if (readingKey(previous.settled) === readingKey(this.state.settled)) return null
    const viewport = this.viewport.current
    if (viewport === null) return null
    const row = [...viewport.querySelectorAll<HTMLElement>('[data-feed-row]')].find(
      (candidate) =>
        candidate.getBoundingClientRect().bottom > viewport.getBoundingClientRect().top,
    )
    if (row === undefined) return null
    return {
      element: row,
      offset: row.getBoundingClientRect().top - viewport.getBoundingClientRect().top,
      atTail: viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop <= 1,
    }
  }

  componentDidUpdate(
    previous: AnchoredFeedProps,
    _state: AnchoredFeedState,
    anchor: Anchor | null,
  ) {
    if (readingKey(previous.settled) !== readingKey(this.props.settled)) {
      if (!this.scrolling) this.setState({ rows: this.props.rows, settled: this.props.settled })
      return
    }
    if (anchor !== null) this.restore(anchor)
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
    const { FeedRow } = this.props
    const { rows, settled } = this.state
    return (
      <MessageScroller.Provider autoScroll defaultScrollPosition="end">
        <MessageScroller.Root className="feed__scroller">
          <MessageScroller.Viewport
            aria-label="Session history"
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
                  <FeedRow height={settled.heights.get(row.id)} row={row} />
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

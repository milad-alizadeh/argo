import { UNREADABLE_ROW } from '../../../../core/sessions/models'
import { ROW_ATTRIBUTE } from '../feed/measure'
import type { SessionFeedRow as SessionFeedRowData } from '../types'

import { FeedMarkdown } from './FeedMarkdown'
import { FeedMarker, FeedPrompt, FeedThought, FeedUnreadable } from './FeedMarks'

type SessionFeedRowProps = { row: SessionFeedRowData; height?: number | null }

// One component for both passes. The row the measure pass lays out and the row the Feed shows
// are the same element at the same width with the same fonts, which is how ADR-0033 rule 2 —
// "a prose row is drawn by the layout that measured it" — holds without any bookkeeping.
//
// `height` is what the pass read for this row, and only the shown row is given one: a row cannot
// be measured against a height taken from measuring it, so the measurement container passes none.
export function SessionFeedRow({ row, height = null }: SessionFeedRowProps) {
  const box = height === null ? undefined : { height: `${height}px` }
  const rowProps = { [ROW_ATTRIBUTE]: row.id, className: `feed-row feed-row--${row.shape}` }
  if (row.shape === 'unreadable') {
    // The one row shape Blink does not lay out from content. Its two numbers are stated once, in
    // the module that states the formula, and written onto the box from there — a CSS copy of
    // them would be a second place for a drawn height to disagree with its own arithmetic.
    return (
      <div {...rowProps} style={{ paddingBlock: `${UNREADABLE_ROW.paddingBlock}px`, ...box }}>
        <FeedUnreadable height={UNREADABLE_ROW.itemHeight} />
      </div>
    )
  }
  return (
    <div {...rowProps} data-role={'role' in row ? row.role : undefined} style={box}>
      <FeedRowBody row={row} />
    </div>
  )
}

function FeedRowBody({ row }: { row: Exclude<SessionFeedRowData, { shape: 'unreadable' }> }) {
  switch (row.shape) {
    case 'thought':
      return <FeedThought row={row} />
    case 'marker':
      return <FeedMarker row={row} />
    case 'source':
      return (
        <div className="feed-row__source">
          <span className="feed-row__label">{row.label}</span>
          <pre className="feed-row__code">{row.source}</pre>
        </div>
      )
    default:
      // Who spoke is said by the shape and not by a label: a prompt is the one thing in a bubble,
      // and everything else in the Feed is the agent's, drawn as the Markdown it was written in.
      return row.role === 'user' ? <FeedPrompt text={row.text} /> : <FeedMarkdown text={row.text} />
  }
}

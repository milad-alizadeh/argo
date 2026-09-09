import type { FeedRow } from '../../sessions/feed'
import { UNREADABLE_ROW } from '../../sessions/feed'
import { ROW_ATTRIBUTE } from './measure'

// One component for both passes. The row the measure pass lays out and the row the Feed shows
// are the same element at the same width with the same fonts, which is how ADR-0033 rule 2 —
// "a prose row is drawn by the layout that measured it" — holds without any bookkeeping.
//
// `height` is what the pass read for this row, and only the shown row is given one: a row cannot
// be measured against a height taken from measuring it, so the measurement container passes none.
export function FeedRowBody({ row, height = null }: { row: FeedRow; height?: number | null }) {
  const box = height === null ? undefined : { height: `${height}px` }
  const rowProps = { [ROW_ATTRIBUTE]: row.id, className: `feed-row feed-row--${row.shape}` }
  if (row.shape === 'unreadable') {
    // The one row shape Blink does not lay out from content. Its two numbers are stated once, in
    // the module that states the formula, and written onto the box from there — a CSS copy of
    // them would be a second place for a drawn height to disagree with its own arithmetic.
    return (
      <div
        {...rowProps}
        style={{
          paddingBlock: `${UNREADABLE_ROW.paddingBlock}px`,
          lineHeight: `${UNREADABLE_ROW.lineHeight}px`,
          ...box,
        }}
      >
        <span className="feed-row__note">Argo could not read this transcript line.</span>
      </div>
    )
  }
  return (
    <div {...rowProps} data-role={row.role} style={box}>
      <span className="feed-row__who">{row.role === 'user' ? 'You' : 'Claude'}</span>
      {row.shape === 'prose' ? (
        <p className="feed-row__prose">{row.text}</p>
      ) : (
        <div className="feed-row__source">
          <span className="feed-row__label">{row.label}</span>
          <pre className="feed-row__code">{row.source}</pre>
        </div>
      )}
    </div>
  )
}

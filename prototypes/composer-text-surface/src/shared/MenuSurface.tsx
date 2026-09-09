// PROTOTYPE. The menu surface, shared by all four variants: what differs between them is where
// this thing is anchored and who owns the keys, not what it draws.

import { useEffect, useRef } from 'react'
import { type Listing, type Row, rowsOf, zeroLineTail } from './menu'
import type { CaretRect } from './surface'

type Props = {
  listing: Listing
  cursor: number
  caret: CaretRect
  onPick(row: Row): void
}

export function Menu({ listing, cursor, caret, onPick }: Props) {
  const surface = useRef<HTMLDivElement>(null)
  const rows = rowsOf(listing)

  // The cursor row stays in view as the walk runs past the ten-row ceiling.
  useEffect(() => {
    surface.current?.querySelectorAll('.row')[cursor]?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  // Stood against the caret, above the line, so the reader's eye does not leave what they typed.
  const left = caret ? Math.max(12, caret.left - 12) : 24
  const bottom = caret ? window.innerHeight - caret.top + 8 : 120

  return (
    <div
      ref={surface}
      className="menu"
      style={{ left, bottom }}
      role="listbox"
      aria-label={listing.sigil.label}
    >
      {listing.status && (
        <div className={`status ${listing.status.mark}`}>
          <span className="dot" />
          {listing.status.words}
        </div>
      )}
      {rows.length > 0 && (
        <div className="list">
          {listing.sections.map((section) => (
            <div key={section.id}>
              {section.label && (
                <div className="section-label">
                  {section.label.toUpperCase()}
                  {section.detail && <span className="detail">{section.detail}</span>}
                </div>
              )}
              {section.rows.map((row) => (
                <div
                  key={row.id}
                  tabIndex={-1}
                  className={`row ${rows[cursor]?.id === row.id ? 'cursor' : ''}`}
                  role="option"
                  aria-selected={rows[cursor]?.id === row.id}
                  onMouseDown={(event) => {
                    // The caret never leaves the composer, not even for a click.
                    event.preventDefault()
                    onPick(row)
                  }}
                >
                  <span className="lead">
                    <Lead row={row} />
                  </span>
                  {row.detail && (
                    <span className={`detail ${row.detail.voice}`}>{row.detail.words}</span>
                  )}
                  {row.badges.map((badge) => (
                    <span key={badge.words} className={`badge ${badge.tone}`}>
                      {badge.words}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {rows.length === 0 && !listing.isReading && (
        <div className="zero">
          {listing.sigil.nothingMatched}
          <span className="typed">
            {listing.sigil.mark}
            {listing.query}
          </span>
          {zeroLineTail}
        </div>
      )}
    </div>
  )
}

/** The characters the typing matched, inked in the accent. */
function Lead({ row }: { row: Row }) {
  if (!row.matched) return <>{row.lead}</>
  const [from, to] = row.matched
  return (
    <>
      {row.lead.slice(0, from)}
      <span className="matched">{row.lead.slice(from, to)}</span>
      {row.lead.slice(to)}
    </>
  )
}

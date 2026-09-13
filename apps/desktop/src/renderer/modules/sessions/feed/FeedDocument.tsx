import { Inbox } from 'lucide-react'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../../../components/ui/empty'
import type { SessionFeed, SessionFeedRow } from '../types'
import { AnchoredFeed } from './AnchoredFeed'
import { useSettledFeed } from './useSettledFeed'

type FeedDocumentProps = { active: boolean; feed: SessionFeed }

function FeedRow({ row, height }: { row: SessionFeedRow; height?: number }) {
  return (
    <article
      className={`feed-row feed-row--${row.shape}`}
      data-feed-row={row.id}
      data-role={'role' in row ? row.role : undefined}
      style={height === undefined ? undefined : { height: `${height}px` }}
    >
      {feedRowContent(row)}
    </article>
  )
}

function feedRowContent(row: SessionFeedRow) {
  switch (row.shape) {
    case 'prose':
    case 'thought':
      return <p className="whitespace-pre-wrap break-words">{row.text}</p>
    case 'source':
      return <p>{row.label}</p>
    case 'marker':
      return <p>{row.marker === 'compacted' ? 'Conversation compacted' : 'Interrupted'}</p>
    case 'unreadable':
      return <p>Part of this transcript is damaged, so Argo cannot show it.</p>
  }
}

// A kept document remains mounted when another Session is selected, retaining that Session's
// scroller state until the reader returns (#1834).
export function FeedDocument({ active, feed }: FeedDocumentProps) {
  const { column, measured, settled } = useSettledFeed({
    active,
    sessionId: feed.sessionId,
    revision: feed.revision,
    rows: feed.rows,
  })
  const content = feedContent(settled)

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
            <FeedRow key={row.id} row={row} />
          ))}
        </div>
        {content}
      </div>
    </div>
  )
}

function feedContent(settled: ReturnType<typeof useSettledFeed>['settled']) {
  if (settled === null) return null
  if (settled.rows.length === 0)
    return (
      <Empty className="h-full border-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Inbox aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>No messages</EmptyTitle>
          <EmptyDescription>This Session has no messages to show.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  return <AnchoredFeed rows={settled.rows} settled={settled} FeedRow={FeedRow} />
}

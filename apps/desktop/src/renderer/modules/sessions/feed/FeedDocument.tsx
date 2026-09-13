import { Inbox } from 'lucide-react'
import { type ReactNode, useCallback, useRef } from 'react'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../../../components/ui/empty'
import type { SessionFeed, SessionFeedRow } from '../types'
import { AnchoredFeed } from './AnchoredFeed'
import { FeedMarkdown } from './content/FeedMarkdown'
import { type Reveal, useRevealAnimation, useReveals } from './reveal'
import { type Settled, useSettledFeed } from './useSettledFeed'

type FeedDocumentProps = {
  active: boolean
  feed: SessionFeed
  onOpenEvidence: (row: Extract<SessionFeedRow, { shape: 'tool' }>) => void
}
type DrawnRowProps = { row: SessionFeedRow; height?: number; reveal?: Reveal }

function FeedRow({
  row,
  height,
  reveal,
  onOpenEvidence,
}: DrawnRowProps & { onOpenEvidence: FeedDocumentProps['onOpenEvidence'] }) {
  const element = useRef<HTMLElement>(null)
  useRevealAnimation(element, reveal)
  const style = height === undefined || height === 0 ? undefined : { height: `${height}px` }

  return (
    <article
      className={`feed-row feed-row--${row.shape}`}
      data-feed-row={row.id}
      data-revealing={reveal === undefined ? undefined : true}
      data-role={'role' in row ? row.role : undefined}
      ref={element}
      style={style}
    >
      {row.shape === 'tool' ? (
        <button type="button" className="feed-evidence-link" onClick={() => onOpenEvidence(row)}>
          {row.label}
        </button>
      ) : (
        feedRowContent(row)
      )}
    </article>
  )
}

function PlainText({ text }: { text: string }) {
  return <p className="whitespace-pre-wrap break-words">{text}</p>
}

function feedRowContent(row: SessionFeedRow) {
  switch (row.shape) {
    case 'prose':
      if (row.role === 'assistant') return <FeedMarkdown text={row.text} />
      return <PlainText text={row.text} />
    case 'thought':
      return <PlainText text={row.text} />
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
export function FeedDocument({ active, feed, onOpenEvidence }: FeedDocumentProps) {
  const { column, measured, settled } = useSettledFeed({
    active,
    sessionId: feed.sessionId,
    revision: feed.revision,
    rows: feed.rows,
  })
  const revealsFor = useReveals()
  const openEvidence = useRef(onOpenEvidence)
  openEvidence.current = onOpenEvidence
  // One component for the life of the deck: a new one each render would remount every row and
  // replay its reveal.
  const DrawnRow = useCallback(
    (props: DrawnRowProps) => (
      <FeedRow {...props} onOpenEvidence={(row) => openEvidence.current(row)} />
    ),
    [],
  )
  const content = feedContent(settled, DrawnRow, revealsFor)

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
            <FeedRow key={row.id} row={row} onOpenEvidence={onOpenEvidence} />
          ))}
        </div>
        {content}
      </div>
    </div>
  )
}

function feedContent(
  settled: ReturnType<typeof useSettledFeed>['settled'],
  DrawnRow: (props: DrawnRowProps) => ReactNode,
  revealsFor: (settled: Settled) => ReadonlyMap<string, Reveal>,
) {
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
  return (
    <AnchoredFeed
      rows={settled.rows}
      settled={settled}
      FeedRow={DrawnRow}
      revealsFor={revealsFor}
    />
  )
}

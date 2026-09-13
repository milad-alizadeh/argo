import { Inbox } from 'lucide-react'
import { useState } from 'react'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../../../components/ui/empty'
import type { SessionFeed, SessionFeedRow } from '../types'
import { AnchoredFeed } from './AnchoredFeed'
import { FeedRow } from './FeedRow'
import { useSettledFeed } from './useSettledFeed'

type FeedDocumentProps = {
  active: boolean
  activeEvidenceId: string | null
  feed: SessionFeed
  onOpenEvidence: (row: Extract<SessionFeedRow, { shape: 'tool' }>) => void
}

// A kept document remains mounted when another Session is selected, retaining that Session's
// scroller state until the reader returns (#1834).
export function FeedDocument({
  active,
  activeEvidenceId,
  feed,
  onOpenEvidence,
}: FeedDocumentProps) {
  const [openToolGroups, setOpenToolGroups] = useState<Set<string>>(new Set())
  const layoutRevision = `${feed.revision}:${[...openToolGroups].sort().join(':')}`
  const { column, measured, settled } = useSettledFeed({
    active,
    sessionId: feed.sessionId,
    revision: layoutRevision,
    rows: feed.rows,
  })
  const onOpenToolGroup = (id: string, open: boolean) => {
    setOpenToolGroups((previous) => {
      const next = new Set(previous)
      if (open) next.add(id)
      else next.delete(id)
      return next
    })
  }
  const content = feedContent({
    settled,
    activeEvidenceId,
    onOpenEvidence,
    openToolGroups,
    onOpenToolGroup,
  })

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
            <FeedRow
              key={row.id}
              activeEvidenceId={activeEvidenceId}
              onOpenEvidence={onOpenEvidence}
              onOpenToolGroup={onOpenToolGroup}
              openToolGroups={openToolGroups}
              row={row}
            />
          ))}
        </div>
        {content}
      </div>
    </div>
  )
}

function feedContent({
  settled,
  activeEvidenceId,
  onOpenEvidence,
  openToolGroups,
  onOpenToolGroup,
}: {
  settled: ReturnType<typeof useSettledFeed>['settled']
  activeEvidenceId: string | null
  onOpenEvidence: FeedDocumentProps['onOpenEvidence']
  openToolGroups: ReadonlySet<string>
  onOpenToolGroup: (id: string, open: boolean) => void
}) {
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
      FeedRow={(props) => (
        <FeedRow
          {...props}
          activeEvidenceId={activeEvidenceId}
          onOpenEvidence={onOpenEvidence}
          onOpenToolGroup={onOpenToolGroup}
          openToolGroups={openToolGroups}
        />
      )}
    />
  )
}

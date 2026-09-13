import { Inbox } from 'lucide-react'
import { type ReactNode, useCallback, useRef, useState } from 'react'
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
import { type Reveal, useReveals } from './reveal'
import { type Settled, useSettledFeed } from './useSettledFeed'

type FeedDocumentProps = {
  active: boolean
  activeEvidenceId: string | null
  feed: SessionFeed
  onOpenEvidence: (row: Extract<SessionFeedRow, { shape: 'tool' }>) => void
}
type DrawnRowProps = { row: SessionFeedRow; height?: number; reveal?: Reveal }

function useToolGroups() {
  const [openToolGroups, setOpenToolGroups] = useState<Set<string>>(new Set())
  const onOpenToolGroup = (id: string, open: boolean) => {
    setOpenToolGroups((previous) => {
      const next = new Set(previous)
      if (open) next.add(id)
      else next.delete(id)
      return next
    })
  }
  return { onOpenToolGroup, openToolGroups }
}

// A kept document remains mounted when another Session is selected, retaining that Session's
// scroller state until the reader returns (#1834).
export function FeedDocument({
  active,
  activeEvidenceId,
  feed,
  onOpenEvidence,
}: FeedDocumentProps) {
  const { onOpenToolGroup, openToolGroups } = useToolGroups()
  const layoutRevision = `${feed.revision}:${[...openToolGroups].sort().join(':')}`
  const { column, measured, settled } = useSettledFeed({
    active,
    sessionId: feed.sessionId,
    revision: layoutRevision,
    rows: feed.rows,
  })
  const revealsFor = useReveals()
  const openEvidence = useRef(onOpenEvidence)
  openEvidence.current = onOpenEvidence
  const toolGroups = useRef<ReadonlySet<string>>(openToolGroups)
  toolGroups.current = openToolGroups
  const evidence = useRef(activeEvidenceId)
  evidence.current = activeEvidenceId
  const openToolGroup = useRef(onOpenToolGroup)
  openToolGroup.current = onOpenToolGroup
  // One component for the life of the deck: a new one each render would remount every row and
  // replay its reveal.
  const DrawnRow = useCallback(
    (props: DrawnRowProps) => (
      <FeedRow
        {...props}
        activeEvidenceId={evidence.current}
        onOpenEvidence={(row) => openEvidence.current(row)}
        onOpenToolGroup={openToolGroup.current}
        openToolGroups={toolGroups.current}
      />
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
            <FeedRow
              key={row.id}
              activeEvidenceId={activeEvidenceId}
              onOpenEvidence={onOpenEvidence}
              onOpenToolGroup={openToolGroup.current}
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

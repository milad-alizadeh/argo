import { Inbox } from 'lucide-react'
import { type ReactNode, useCallback, useRef, useState } from 'react'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../../../components/ui/empty'
import { Spinner } from '../../../components/ui/spinner'
import type { SessionFeed, SessionFeedRow } from '../types'
import { AnchoredFeed } from './AnchoredFeed'
import { CompactionMarker } from './CompactionMarker'
import { FeedRow } from './FeedRow'
import { type Reveal, useReveals } from './reveal'
import { type Settled, useSettledFeed } from './useSettledFeed'

type FeedDocumentProps = {
  active: boolean
  activeEvidenceId: string | null
  compactionStartedAt: string | null
  compactionPercentage: number | null
  compactionTokens: string | null
  feed: SessionFeed
  isRunning: boolean
  onOpenEvidence: (row: Extract<SessionFeedRow, { shape: 'tool' }>) => void
}
type DrawnRowProps = { row: SessionFeedRow; height?: number; reveal?: Reveal }

function compactionMarker(
  startedAt: string | null,
  percentage: number | null,
  tokens: string | null,
) {
  return startedAt === null ? null : (
    <CompactionMarker percentage={percentage} startedAt={startedAt} tokens={tokens} />
  )
}

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
  compactionStartedAt,
  compactionPercentage,
  compactionTokens,
  feed,
  isRunning,
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
  const content = feedContent({ settled, isRunning, DrawnRow, revealsFor })

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
        {compactionMarker(compactionStartedAt, compactionPercentage, compactionTokens)}
      </div>
    </div>
  )
}

function feedContent({
  settled,
  isRunning,
  DrawnRow,
  revealsFor,
}: {
  settled: ReturnType<typeof useSettledFeed>['settled']
  isRunning: boolean
  DrawnRow: (props: DrawnRowProps) => ReactNode
  revealsFor: (settled: Settled) => ReadonlyMap<string, Reveal>
}) {
  if (settled === null) return isRunning ? <RunningFeed /> : null
  if (settled.rows.length === 0 && isRunning) return <RunningFeed />
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

function RunningFeed() {
  return (
    <section className="grid h-full place-items-center" data-state="running">
      <Spinner className="size-6" />
    </section>
  )
}

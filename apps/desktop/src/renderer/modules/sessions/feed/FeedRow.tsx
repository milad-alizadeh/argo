import type { SessionFeedRow } from '../types'
import { FeedMarkdown } from './content/FeedMarkdown'
import { FeedToolGroup, FeedToolLine } from './FeedTools'

export type FeedRowProps = {
  row: SessionFeedRow
  height?: number
  activeEvidenceId: string | null
  openToolGroups: ReadonlySet<string>
  onOpenToolGroup: (id: string, open: boolean) => void
  onOpenEvidence: (row: Extract<SessionFeedRow, { shape: 'tool' }>) => void
}

export function FeedRow({
  row,
  height,
  activeEvidenceId,
  onOpenEvidence,
  openToolGroups,
  onOpenToolGroup,
}: FeedRowProps) {
  return (
    <article
      className={`feed-row feed-row--${row.shape}`}
      data-feed-row={row.id}
      data-role={'role' in row ? row.role : undefined}
      style={height === undefined || height === 0 ? undefined : { height: `${height}px` }}
    >
      <FeedRowContent
        onOpenEvidence={onOpenEvidence}
        activeEvidenceId={activeEvidenceId}
        onOpenToolGroup={onOpenToolGroup}
        openToolGroups={openToolGroups}
        row={row}
      />
    </article>
  )
}

function FeedRowContent({
  row,
  onOpenEvidence,
  activeEvidenceId,
  openToolGroups,
  onOpenToolGroup,
}: Omit<FeedRowProps, 'height'>) {
  switch (row.shape) {
    case 'tool':
      return <FeedToolLine activeEvidenceId={activeEvidenceId} call={row} onOpen={onOpenEvidence} />
    case 'tool-group':
      return (
        <FeedToolGroup
          group={row}
          activeEvidenceId={activeEvidenceId}
          onOpen={onOpenEvidence}
          onOpenChange={(open) => onOpenToolGroup(row.id, open)}
          open={openToolGroups.has(row.id)}
        />
      )
    default:
      return feedRowContent(row)
  }
}

function PlainText({ text }: { text: string }) {
  return <p className="whitespace-pre-wrap break-words">{text}</p>
}

function feedRowContent(row: Exclude<SessionFeedRow, { shape: 'tool' | 'tool-group' }>) {
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

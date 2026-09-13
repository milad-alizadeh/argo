import type { RefObject } from 'react'

import type { SessionFeed, SessionFeedRow } from '../types'
import { FeedRow } from './FeedRow'

export function MeasuredRows({
  activeEvidenceId,
  feed,
  measured,
  onOpenEvidence,
  onOpenToolGroup,
  openToolGroups,
}: {
  activeEvidenceId: string | null
  feed: SessionFeed
  measured: RefObject<HTMLDivElement | null>
  onOpenEvidence: (row: Extract<SessionFeedRow, { shape: 'tool' }>) => void
  onOpenToolGroup: (id: string, open: boolean) => void
  openToolGroups: ReadonlySet<string>
}) {
  return (
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
  )
}

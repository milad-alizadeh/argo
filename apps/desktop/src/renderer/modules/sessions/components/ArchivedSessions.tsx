import type { ReactNode } from 'react'

import type { SessionId, SessionsListed } from '../types'

export function ArchivedSessions({
  archived,
  rows,
  selectedSessionId,
}: {
  archived: SessionsListed['sessions']
  rows: (sessions: SessionsListed['sessions'], label: string) => ReactNode
  selectedSessionId: SessionId | null
}) {
  if (archived.length === 0) return null
  return (
    <details
      className="border-t border-border/60 py-3"
      open={archived.some((session) => session.id === selectedSessionId)}
    >
      <summary className="cursor-pointer px-4 text-sm">Archived {archived.length}</summary>
      <div className="pt-2">{rows(archived, 'Archived')}</div>
    </details>
  )
}

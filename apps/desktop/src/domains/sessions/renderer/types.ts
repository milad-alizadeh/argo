import type { SessionFeedRow } from '@/domains/sessions/api/feed/feed-rows'
import type { SessionError } from '@/domains/sessions/api/session-error'
import type { RouterOutputs } from '@/platform/renderer/trpc-client'

export type SessionListWindow = RouterOutputs['sessionListWindow']
export type Session = SessionListWindow['rows'][number]
export type SessionId = Session['id']
export type SessionDetailsUpdate = RouterOutputs['sessionDetails']

// One chain's Feed as the renderer draws it: main's reading, reduced to what a row needs. The
// revision changes whenever the rows do, and a mounted row whose revision held draws nothing.
export type SessionFeed = {
  sessionId: string
  chainId: string
  revision: string
  rows: SessionFeedRow[]
}

export type { SessionError }
// The retained rows of a list view: `sessions` stand at list positions from `offset` on.
export type SessionListRetainedWindow = Pick<SessionListWindow, 'total' | 'offset'> & {
  sessions: Session[]
}
export type { SessionFeedRow }

export type SessionDiagramEvidence = {
  shape: 'diagram'
  id: string
  title: string
  source: string
}
export type SessionSkillEvidence = {
  shape: 'skill'
  id: string
  name: string
  path: string
}
export type SessionFileEvidence = {
  shape: 'file'
  id: string
  path: string
}
export type SessionEvidence =
  | Extract<SessionFeedRow, { shape: 'tool' }>
  | SessionDiagramEvidence
  | SessionSkillEvidence
  | SessionFileEvidence

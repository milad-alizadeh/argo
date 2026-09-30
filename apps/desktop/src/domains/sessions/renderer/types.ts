import type { SessionFeedRow } from '@/domains/sessions/api/feed'
import type { SessionError } from '@/domains/sessions/api/session-error'
import type { RouterOutputs } from '@/platform/renderer/trpc-client'

export type SessionListUpdate = RouterOutputs['sessionList']
export type SessionListResult = Extract<SessionListUpdate, { type: 'list' }>
export type Session = SessionListResult['rows'][number]
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
export type SessionListPage = Pick<SessionListResult, 'total'> & {
  sessions: Session[]
  nextPage: number | null
  historyComplete: boolean
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

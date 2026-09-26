import type { SessionError } from '@/domains/sessions/api/session-error'
import type { SessionFeedRow, SessionRow } from '@/domains/sessions/renderer/model/models'

export type SessionSearched = {
  version: 1
  type: 'session.searched'
  requestId: string
  sessions: SessionRow[]
  nextCursor: string | null
  historyComplete: boolean
}

export type SessionArchiveListed = {
  version: 1
  type: 'session.archive.listed'
  requestId: string
  sessions: SessionRow[]
  nextCursor: string | null
  restored: SessionRow | null
  historyComplete: boolean
}

export type SessionFeed = {
  version: 1
  type: 'session.feed.read'
  requestId: string
  sessionId: string
  chainId: string
  revision: string
  rows: SessionFeedRow[]
}

export type { SessionError }
export type SessionListPage = {
  sessions: SessionRow[]
  total: number
  nextPage: number | null
  historyComplete: boolean
  partialFailures: { harness: string; code: string }[]
}
export type Session = SessionRow
export type SessionId = Session['id']
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

export function sessionPostureLocksAnswer(posture: Session['posture'] | null): boolean {
  return posture !== 'live'
}

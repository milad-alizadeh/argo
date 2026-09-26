import type { SessionError } from '@/domains/sessions/api/session-error'
import type { SessionFeedRow } from '@/domains/sessions/renderer/model/models'
import type { RouterOutputs } from '@/platform/renderer/trpc-client'

export type SessionListResult = RouterOutputs['sessions']['list']
export type Session = SessionListResult['rows'][number]
export type SessionId = Session['id']

export type SessionArchiveListed = {
  version: 1
  type: 'session.archive.listed'
  requestId: string
  sessions: Session[]
  nextCursor: string | null
  restored: Session | null
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

export function sessionPostureLocksAnswer(posture: Session['posture'] | null): boolean {
  return posture !== 'live'
}

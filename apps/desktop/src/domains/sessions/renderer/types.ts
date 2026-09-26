import type { SessionError } from '@/domains/sessions/api/session-error'
import type { SessionFeedRow, SessionRosterRow } from '@/domains/sessions/renderer/model/models'

// The renderer's current Roster state. The old request envelope has no consumer here.
export type SessionsListed = {
  version: 1
  type: 'session.listed'
  requestId: string
  sessions: SessionRosterRow[]
  partialFailures: { harness: string; code: string }[]
  filesFound: number
  filesRead: number
  filesUnreadable: number
  filesParsed: number
  nextCursor: string | null
  historyComplete: boolean
}

export type SessionSearched = {
  version: 1
  type: 'session.searched'
  requestId: string
  sessions: SessionRosterRow[]
  nextCursor: string | null
  historyComplete: boolean
}

export type SessionArchiveListed = {
  version: 1
  type: 'session.archive.listed'
  requestId: string
  sessions: SessionRosterRow[]
  nextCursor: string | null
  restored: SessionRosterRow | null
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
export type SessionRoster = Omit<SessionsListed, 'version' | 'type' | 'requestId'>
export type Session = SessionRosterRow
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

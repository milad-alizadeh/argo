import type { SessionFeedRow } from '@/domains/sessions/api/feed/feed-rows'
import type { FeedSubagent } from '@/domains/sessions/api/feed/feed-subagents'
import type { SessionError } from '@/domains/sessions/api/session-error'
import type { RouterOutputs } from '@/platform/renderer/trpc-client'

export type SessionListResult = RouterOutputs['sessionList']
export type Session = SessionListResult['rows'][number]
export type SessionId = Session['id']
export type SessionPosture = NonNullable<Session['posture']>
export type SessionActivity = NonNullable<Session['activity']>
export type SessionPlan = NonNullable<Session['plan']>
export type PlanEntryStatus = Extract<
  SessionPlan,
  { state: 'available' }
>['entries'][number]['status']
export type SessionTicket = NonNullable<Session['ticket']>
export type SessionShellCommand = Session['shell'][number]
export type ShellState = SessionShellCommand['state']
export type SessionTurnConfiguration = Session['turnConfiguration']
// Only the Feed knows a Subagent's nickname; the roster never records one.
export type SessionSubagent = Session['subagents'][number] & Pick<FeedSubagent, 'nickname'>

// One chain's Feed as the renderer draws it: main's reading, reduced to what a row needs. The
// revision changes whenever the rows do, and a mounted row whose revision held draws nothing.
export type SessionFeed = {
  sessionId: string
  chainId: string
  revision: string
  rows: SessionFeedRow[]
}

export type { SessionError, SessionFeedRow }

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

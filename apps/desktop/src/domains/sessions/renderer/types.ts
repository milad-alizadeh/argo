import type { FeedSubagent, SessionFeedRow } from '@/domains/sessions/api/feed'
import type { SessionError } from '@/domains/sessions/api/session-error'
import type { RouterOutputs } from '@/platform/renderer/trpc-client'

export type SessionListResult = RouterOutputs['sessionList']
export type Session = SessionListResult['rows'][number]
export type SessionId = Session['id']
export type SessionPosture = NonNullable<Session['posture']>
export type SessionActivity = NonNullable<Session['activity']>
export type SessionTicket = NonNullable<Session['ticket']>
export type SessionTurnConfiguration = Session['turnConfiguration']
export type PlanEntryStatus = 'pending' | 'in_progress' | 'completed'
export type SessionPlan =
  | {
      state: 'available'
      entries: { content: string; position: number; status: PlanEntryStatus }[]
    }
  | { state: 'malformed' }
// The composer's Plan: the steps from an open Feed, or only their count from the stored row.
export type ComposerPlan =
  | SessionPlan
  | ({ state: 'counted' } & NonNullable<Session['planProgress']>)
export type ShellState = 'running' | 'completed' | 'failed' | 'interrupted'
export type SessionShellCommand = {
  id: string
  command: string | null
  label: string | null
  background: boolean
  state: ShellState
  startedAt: string | null
  endedAt: string | null
  outputPath: string | null
  result: string | null
}
// What the UI draws when a Session carries it; no read reports these yet, so each is optional.
export type SessionExtras = {
  plan?: SessionPlan | null
  // #2970 lists the shell commands.
  shell?: SessionShellCommand[]
  // #2968 reports context usage.
  contextTokens?: number | null
  contextWindowTokens?: number | null
  // #2969 reports the handoff links.
  handoffTo?: string | null
  handoffFrom?: string | null
}
// Only the Feed knows a Subagent's nickname; the Session index never records one, nor yet its times.
export type SessionSubagent = Session['subagents'][number] &
  Pick<FeedSubagent, 'nickname'> & { startedAt?: string | null; endedAt?: string | null }

// One chain's Feed as the renderer draws it: main's reading, reduced to what a row needs. The
// revision changes whenever the rows do, and a mounted row whose revision held draws nothing.
export type SessionFeed = {
  sessionId: string
  chainId: string
  revision: string
  rows: SessionFeedRow[]
  // Present while older rows exist before the first; asks main for the page before it.
  loadOlder?: () => void
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

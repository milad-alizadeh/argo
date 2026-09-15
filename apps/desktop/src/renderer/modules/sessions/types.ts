import type {
  SessionArchiveListed,
  SessionError,
  SessionFeedRead,
  SessionFeedRequest,
  SessionListRequest,
  SessionsListed,
} from '@/core/sessions/contract'

export type {
  SessionArchiveListed,
  SessionError,
  SessionFeedRead as SessionFeed,
  SessionFeedRequest,
  SessionListRequest,
  SessionsListed,
}

export type Session = SessionsListed['sessions'][number]
export type SessionId = Session['id']
export type SessionFeedRow = SessionFeedRead['rows'][number]

// A diagram is recorded assistant prose (a mermaid fence), not a tool call, so it carries its own
// evidence shape rather than reusing `SessionFeedRow`'s tool variant.
export type SessionDiagramEvidence = {
  shape: 'diagram'
  id: string
  title: string
  source: string
}
// A skill a prompt mentions, opened by the path the CLI wrote into the prompt.
export type SessionSkillEvidence = {
  shape: 'skill'
  id: string
  name: string
  path: string
}
export type SessionEvidence =
  | Extract<SessionFeedRow, { shape: 'tool' }>
  | SessionDiagramEvidence
  | SessionSkillEvidence

// Argo can only write an answer into a Session whose channel it currently holds (#2205): every
// other posture — another Argo window, an external terminal, or simply idle — locks the answer
// affordance, whatever the transcript says. The one rule, shared by the roster badge/lock icon
// and the Feed's inline question form.
export function sessionPostureLocksAnswer(posture: Session['posture'] | null): boolean {
  return posture !== 'managed'
}

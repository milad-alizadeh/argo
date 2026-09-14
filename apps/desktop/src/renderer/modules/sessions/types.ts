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
export type SessionEvidence = Extract<SessionFeedRow, { shape: 'tool' }> | SessionDiagramEvidence

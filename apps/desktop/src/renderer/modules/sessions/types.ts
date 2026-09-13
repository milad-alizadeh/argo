import type {
  SessionError,
  SessionFeedRead,
  SessionFeedRequest,
  SessionListRequest,
  SessionsListed,
} from '@/core/sessions/contract'

export type {
  SessionError,
  SessionFeedRead as SessionFeed,
  SessionFeedRequest,
  SessionListRequest,
  SessionsListed,
}

export type Session = SessionsListed['sessions'][number]
export type SessionId = Session['id']
export type SessionFeedRow = SessionFeedRead['rows'][number]

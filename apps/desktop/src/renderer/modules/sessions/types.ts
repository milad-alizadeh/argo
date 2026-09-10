import type {
  SessionFeedRead,
  SessionFeedRequest,
  SessionListRequest,
  SessionsListed,
} from '../../../sessions/contract'

export type { SessionFeedRequest, SessionListRequest, SessionFeedRead as SessionFeed, SessionsListed }

export type Session = SessionsListed['sessions'][number]
export type SessionId = Session['id']
export type SessionFeedRow = SessionFeedRead['rows'][number]

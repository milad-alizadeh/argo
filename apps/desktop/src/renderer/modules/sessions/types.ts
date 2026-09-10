import type {
  SessionFeedRead,
  SessionFeedRequest,
  SessionListRequest,
  SessionsListed,
} from '../../../sessions/contract'

export type {
  SessionFeedRead as SessionFeed,
  SessionFeedRequest,
  SessionListRequest,
  SessionsListed,
}

export type Session = SessionsListed['sessions'][number]
export type SessionId = Session['id']
export type SessionFeedRow = SessionFeedRead['rows'][number]

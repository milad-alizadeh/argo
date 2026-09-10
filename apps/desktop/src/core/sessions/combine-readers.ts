import type { SessionReader } from './bridge'
import {
  type SessionFeedReply,
  type SessionListReply,
  type SessionsListed,
  sessionError,
} from './contract'
import { isSessionFeedReply, isSessionListReply } from './replies'

function listed(reply: SessionListReply): reply is SessionsListed {
  return reply.type === 'session.listed'
}

function combineLists(replies: SessionListReply[]): SessionListReply {
  const successful = replies.filter(listed)
  if (successful.length === 0) return replies[0] ?? sessionError('internal-error', null)
  const first = successful[0]
  if (first === undefined) return sessionError('internal-error', null)
  return {
    version: 1,
    type: 'session.listed',
    requestId: first.requestId,
    sessions: successful.flatMap((reply) => reply.sessions),
    filesFound: successful.reduce((total, reply) => total + reply.filesFound, 0),
    filesRead: successful.reduce((total, reply) => total + reply.filesRead, 0),
    filesUnreadable: successful.reduce((total, reply) => total + reply.filesUnreadable, 0),
  }
}

function combineFeeds(replies: SessionFeedReply[]): SessionFeedReply {
  const feed = replies.find((reply) => reply.type === 'session.feed.read')
  if (feed !== undefined) return feed
  return (
    replies.find((reply) => reply.type === 'session.error' && reply.code !== 'missing-session') ??
    replies[0] ??
    sessionError('internal-error', null)
  )
}

// A Session id is owned by the CLI that wrote its transcript. The combined reader asks each
// registered adapter and returns that adapter's feed; listing aggregates their independent sweeps.
export function combineSessionReaders(readers: SessionReader[]): SessionReader {
  return {
    async listSessions(request) {
      const replies = await Promise.all(readers.map((reader) => reader.listSessions(request)))
      const parsed = replies.filter(isSessionListReply)
      if (parsed.length !== readers.length) return sessionError('invalid-response', null)
      return combineLists(parsed)
    },
    async readSessionFeed(request) {
      const replies = await Promise.all(readers.map((reader) => reader.readSessionFeed(request)))
      const parsed = replies.filter(isSessionFeedReply)
      if (parsed.length !== readers.length) return sessionError('invalid-response', null)
      return combineFeeds(parsed)
    },
  }
}

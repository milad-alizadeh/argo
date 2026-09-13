import type { SessionReader } from './bridge'
import {
  type SessionFeedReply,
  type SessionListReply,
  type SessionsListed,
  sessionError,
  sessionFeedReplySchema,
  sessionListReplySchema,
} from './contract'

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
    sessions: successful
      .flatMap((reply) => reply.sessions)
      .sort((left, right) => (right.updatedAt ?? '').localeCompare(left.updatedAt ?? '')),
    filesFound: successful.reduce((total, reply) => total + reply.filesFound, 0),
    filesRead: successful.reduce((total, reply) => total + reply.filesRead, 0),
    filesUnreadable: successful.reduce((total, reply) => total + reply.filesUnreadable, 0),
  }
}

function combineFeeds(replies: SessionFeedReply[]): SessionFeedReply {
  const feed = replies.find((reply) => reply.type === 'session.feed.read')
  if (feed !== undefined) return feed
  const unchanged = replies.find((reply) => reply.type === 'session.feed.unchanged')
  if (unchanged !== undefined) return unchanged
  return (
    replies.find((reply) => reply.type === 'session.error' && reply.code !== 'missing-session') ??
    replies[0] ??
    sessionError('internal-error', null)
  )
}

function ownerFor(request: unknown, owners: Map<string, SessionReader>): SessionReader | undefined {
  if (typeof request !== 'object' || request === null || !('sessionId' in request)) return undefined
  return typeof request.sessionId === 'string' ? owners.get(request.sessionId) : undefined
}

function ownerOfReply(
  readers: SessionReader[],
  replies: unknown[],
  reply: SessionFeedReply,
): SessionReader | undefined {
  return readers.find((_reader, index) => replies[index] === reply)
}

// A Session id is owned by the CLI that wrote its transcript. The combined reader asks each
// registered adapter and returns that adapter's feed; listing aggregates their independent sweeps.
export function combineSessionReaders(readers: SessionReader[]): SessionReader {
  const feedOwners = new Map<string, SessionReader>()
  return {
    async listSessions(request) {
      const replies = await Promise.all(readers.map((reader) => reader.listSessions(request)))
      const parsed = replies.flatMap((reply) => {
        const result = sessionListReplySchema.safeParse(reply)
        return result.success ? [result.data] : []
      })
      if (parsed.length !== readers.length) return sessionError('invalid-response', null)
      return combineLists(parsed)
    },
    async readSessionFeed(request) {
      const knownOwner = ownerFor(request, feedOwners)
      if (knownOwner !== undefined) return knownOwner.readSessionFeed(request)
      const replies = await Promise.all(readers.map((reader) => reader.readSessionFeed(request)))
      const parsed = replies.flatMap((reply) => {
        const result = sessionFeedReplySchema.safeParse(reply)
        return result.success ? [result.data] : []
      })
      if (parsed.length !== readers.length) return sessionError('invalid-response', null)
      const reply = combineFeeds(parsed)
      if (reply.type === 'session.feed.read') {
        const owner = ownerOfReply(readers, replies, reply)
        if (owner !== undefined) feedOwners.set(reply.sessionId, owner)
      }
      return reply
    },
  }
}

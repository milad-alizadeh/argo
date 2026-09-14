// Reading one Session's Feed from the adapter that owns it, cached, staleness-checked, and with a
// live overlay applied when the source supplies one (#2025).
import { createHash } from 'node:crypto'

import { type SessionFeedReply, type SessionFeedRequest, sessionError } from './contract'
import { feedReply, type HeldFeed, keepFeed, stableChain, unchangedReply } from './feed-cache'
import type { SessionSource } from './session-source'

type FeedContext = { source: SessionSource; feeds: Map<string, HeldFeed>; managed: boolean }

function feedRevision(chainId: string, stamps: string) {
  return createHash('sha256').update(JSON.stringify({ chainId, stamps })).digest('hex')
}

// A managed Session reads as an empty Feed until its CLI writes the first transcript line.
function unwrittenFeed(value: SessionFeedRequest) {
  return feedReply(value, {
    chainId: value.sessionId,
    paths: [],
    rows: [],
    revision: feedRevision(value.sessionId, ''),
    stamps: '',
  })
}

export async function readOwnedFeed(
  context: FeedContext,
  value: SessionFeedRequest,
): Promise<SessionFeedReply> {
  const { source, feeds, managed } = context
  const held = feeds.get(value.sessionId)
  // The chain a resume belongs to can gain a file the held record never knew about (a Session
  // Argo never started, resumed for the first time): the file the held record already tracks
  // never changes, so statting only those paths would call this Feed unchanged forever. Deriving
  // the chain fresh every read, before trusting the cache, is what catches a new member.
  const stable = await stableChain(source, value.sessionId, held?.paths ?? [])
  if (stable === null) {
    if (managed) return unwrittenFeed(value)
    return sessionError('missing-session', value.requestId)
  }
  const { chain, stamps } = stable
  if (held !== undefined && held.stamps === stamps) {
    keepFeed(feeds, value.sessionId, held)
    return value.revision === held.revision ? unchangedReply(value, held) : feedReply(value, held)
  }
  const rows = source.projectFeed(chain)
  const revision = feedRevision(chain.id, stamps)
  const next = {
    chainId: chain.id,
    paths: chain.files.map((file) => file.path),
    rows,
    revision,
    stamps,
  }
  keepFeed(feeds, value.sessionId, next)
  return feedReply(value, next)
}

// An overlay changes with no file changing, so while one is shown the document is read whole and
// the revision covers both; a renderer that holds that revision is told so.
export async function readFeedWithOverlay(
  context: FeedContext,
  value: SessionFeedRequest,
): Promise<SessionFeedReply> {
  const overlay = context.source.overlayFor?.(value.sessionId) ?? null
  if (overlay === null) return readOwnedFeed(context, value)
  const reply = await readOwnedFeed(context, { ...value, revision: null })
  if (reply.type !== 'session.feed.read') return reply
  const shown = overlay(reply.rows)
  const revision = createHash('sha256')
    .update(JSON.stringify({ revision: reply.revision, changes: shown.changes }))
    .digest('hex')
  const read = { ...reply, revision, rows: shown.rows }
  if (read.revision !== value.revision) return read
  const { rows: _rows, ...unchanged } = read
  return { ...unchanged, type: 'session.feed.unchanged' }
}

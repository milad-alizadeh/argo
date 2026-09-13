import { createHash } from 'node:crypto'
import type { SessionReader } from './bridge'
import type { SessionFeedReply, SessionFeedRequest } from './contract'
import type { SessionFeedRow } from './models'

// What a driver shows over one Session's recorded Feed while a Turn streams: the rows to draw, and
// everything it changed about them, which the revision must cover.
export type FeedOverlay = (rows: readonly SessionFeedRow[]) => {
  rows: SessionFeedRow[]
  changes: unknown
}

// An overlay changes with no file changing, so while one is shown the document is read whole and
// the revision covers both; a renderer that holds that revision is told so.
async function readOverlaidFeed(
  reader: SessionReader,
  request: SessionFeedRequest,
  overlayFor: (sessionId: string) => FeedOverlay | null,
): Promise<SessionFeedReply> {
  const overlay = overlayFor(request.sessionId)
  if (overlay === null) return reader.readSessionFeed(request)
  const reply = await reader.readSessionFeed({ ...request, revision: null })
  if (reply.type !== 'session.feed.read') return reply
  const shown = overlay(reply.rows)
  const revision = createHash('sha256')
    .update(JSON.stringify({ revision: reply.revision, changes: shown.changes }))
    .digest('hex')
  const read = { ...reply, revision, rows: shown.rows }
  if (read.revision !== request.revision) return read
  const { rows: _rows, ...unchanged } = read
  return { ...unchanged, type: 'session.feed.unchanged' }
}

export function withFeedOverlay(
  reader: SessionReader,
  overlayFor: (sessionId: string) => FeedOverlay | null,
): SessionReader {
  return {
    listSessions: reader.listSessions,
    readSessionFeed: (request) => readOverlaidFeed(reader, request, overlayFor),
  }
}

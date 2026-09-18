// The active Roster read: every adapter's window merged into one list, then joined with the two
// pieces of Session state that are Argo's own rather than any CLI's — the Ticket link and the
// archive flag (#2315).

import type { SessionTicketLinkStore } from '../../domains/tickets/main/session-links'
import { isArchivedSession, type SessionArchiveStore } from '../storage/session-archive'
import { type SessionListRequest, sessionError } from './contract'
import type { Discovered } from './merge-discovery'
import { combineDiscoveries } from './merge-discovery'
import { readFailure } from './read-declaration'
import { decodeRosterCursor } from './roster-cursor'
import type { SessionSource } from './session-source'

// Project scope is applied inside each adapter's own `discoverSessions` (#2239), at the boundary
// where that adapter's rows are built — never here, after every adapter has already read a
// machine-wide window only to have most of it discarded.
async function discoverFromSource(
  source: SessionSource,
  requestId: string,
  options: { cursor: string | null; projectRoot: string | null },
): Promise<Discovered> {
  try {
    const discovery = await source.discoverSessions(options)
    const isLockedElsewhere = source.isLockedElsewhere
    if (isLockedElsewhere === undefined) return discovery
    return {
      ...discovery,
      rows: discovery.rows.map((row) => ({
        ...row,
        locked: row.locked === true || isLockedElsewhere(row.id),
      })),
    }
  } catch (error) {
    return { error: sessionError(readFailure(error), requestId) }
  }
}

// The active Roster never carries an archived row (#1593): expanding Archive asks the archive
// list for one instead, on demand. The join is Argo's own store rather than any one adapter's, so
// a Session from every harness drops out of the active list the same way.
async function withoutArchived<Row extends { id: string; retiredIds: string[] }>(
  rows: Row[],
  archive: SessionArchiveStore,
): Promise<Row[]> {
  const archivedIds = await archive.archivedIds()
  return rows.filter((row) => !isArchivedSession(row, archivedIds))
}

export async function listReply(
  sources: SessionSource[],
  ownership: { rememberDiscoveries: (sessions: { id: string; cli: string }[]) => void },
  {
    ticketLinks,
    archive,
    request,
  }: {
    ticketLinks: SessionTicketLinkStore
    archive: SessionArchiveStore
    request: SessionListRequest
  },
) {
  const cursors = decodeRosterCursor(request.cursor)
  const discovered = await Promise.all(
    sources.map((source) =>
      discoverFromSource(source, request.requestId, {
        cursor: cursors[source.cli] ?? null,
        projectRoot: request.projectRoot,
      }),
    ),
  )
  const clis = sources.map((source) => source.cli)
  const reply = combineDiscoveries(discovered, clis, request.requestId)
  if (reply.type !== 'session.listed') return reply
  ownership.rememberDiscoveries(reply.sessions)
  // An archived Session is never in the active list (#1593): the Archive page asks for one
  // instead, on demand. The flag is Argo's own, so every harness's rows drop out the same way.
  const active = await withoutArchived(reply.sessions, archive)
  // The Session → Ticket link is Argo's own owned state, never a transcript fact, so it joins
  // in here rather than in any one CLI's discovery (CONTEXT.md L1 · Session → Ticket).
  const sessions = await Promise.all(
    active.map(async (session) => ({
      ...session,
      ticket: await ticketLinks.linkFor(session.id),
    })),
  )
  return { ...reply, sessions }
}

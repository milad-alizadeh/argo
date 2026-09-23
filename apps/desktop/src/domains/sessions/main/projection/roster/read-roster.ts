// The active Roster read: every adapter's window merged into one list, then joined with the two
// pieces of Session state that are Argo's own rather than any Harness's — the Ticket link and the
// archive flag (#2315).

import { type SessionListRequest, sessionError } from '@/domains/sessions/contract/ipc'
import type { SessionRosterRow } from '@/domains/sessions/contract/model/models'
import type { SessionTicketLinkStore } from '@/domains/tickets/main'
import { isArchivedSession, type SessionArchiveStore } from '../../archive/store/archive-store'
import {
  combineDiscoveries,
  type Discovered,
  isDiscoveryError,
} from '../../observation/reader/merge-discovery'
import { readFailure } from '../../observation/reader/read-declaration'
import type { SessionSource } from '../../observation/reader/reader'
import { ROSTER_PAGE_SIZE } from '../../observation/reader/roster-page-size'
import type { SessionUnreadStore } from '../../unread/unread-store'
import {
  cursorWithKnown,
  decodeUnifiedRosterCursor,
  encodeUnifiedRosterCursor,
  type UnifiedRosterCursorState,
} from './unified-roster-cursor'
import { mergeRosterPage, type UnifiedRosterSource } from './unified-roster-page'

// A Harness that cannot answer its current window must not keep another Harness's ready rows off
// the Roster (ADR-0008): the renderer can show the partial reply and retry this source next poll.
const SOURCE_READ_BUDGET_MS = 750

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
        locked:
          row.locked === true ||
          ((row.posture === 'external' || row.posture === 'watched') && isLockedElsewhere(row.id)),
      })),
    }
  } catch (error) {
    return { error: sessionError(readFailure(error), requestId) }
  }
}

async function discoverWithinBudget(
  source: SessionSource,
  requestId: string,
  options: { cursor: string | null; projectRoot: string | null },
): Promise<Discovered> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      discoverFromSource(source, requestId, options),
      new Promise<Discovered>((resolve) => {
        timeout = setTimeout(
          () =>
            resolve({
              error: sessionError('vendor-history-unavailable', requestId),
            }),
          SOURCE_READ_BUDGET_MS,
        )
      }),
    ])
  } finally {
    if (timeout !== undefined) clearTimeout(timeout)
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

type ReadSource = {
  discovery: Discovered | null
  previous: UnifiedRosterCursorState['sources'][string] | undefined
  source: SessionSource
}

async function readSources(
  sources: SessionSource[],
  cursor: UnifiedRosterCursorState,
  request: SessionListRequest,
): Promise<ReadSource[]> {
  return Promise.all(
    sources.map(async (source) => {
      const previous = cursor.sources[source.harness]
      const needsProviderPage =
        previous === undefined ||
        (previous.cursor !== null && previous.buffer.length < ROSTER_PAGE_SIZE)
      if (!needsProviderPage) return { previous, source, discovery: null }
      const discovery = await discoverWithinBudget(source, request.requestId, {
        cursor: previous?.cursor ?? null,
        projectRoot: request.projectRoot,
      })
      if (isDiscoveryError(discovery) || previous === undefined)
        return { previous, source, discovery }
      const known = new Set(previous.known)
      return {
        previous,
        source,
        discovery: {
          ...discovery,
          rows: discovery.rows.filter((row) => !known.has(row.id)),
        },
      }
    }),
  )
}

function replyFor(sources: SessionSource[], readings: ReadSource[], requestId: string) {
  return combineDiscoveries(
    readings.map(({ discovery, previous }) => combinedDiscovery(discovery, previous)),
    sources.map((source) => source.harness),
    requestId,
  )
}

function combinedDiscovery(
  discovery: Discovered | null,
  previous: ReadSource['previous'],
): Discovered {
  if (discovery === null)
    return {
      rows: previous?.buffer ?? [],
      filesFound: 0,
      filesRead: 0,
      filesUnreadable: 0,
      filesParsed: 0,
      nextCursor: previous?.cursor ?? null,
      historyComplete: true,
    }
  if (isDiscoveryError(discovery)) return discovery
  return {
    ...discovery,
    rows: [...(previous?.buffer ?? []), ...discovery.rows],
  }
}

function pageFor(sources: SessionSource[], readings: ReadSource[], sessions: SessionRosterRow[]) {
  const pages: UnifiedRosterSource[] = sources.map((source) => {
    const reading = readings.find((candidate) => candidate.source === source)
    const discovery = reading?.discovery
    return {
      harness: source.harness,
      nextCursor:
        discovery !== null && discovery !== undefined && !isDiscoveryError(discovery)
          ? discovery.nextCursor
          : (reading?.previous?.cursor ?? null),
      rows: [],
    }
  })
  for (const session of sessions) {
    const page = pages.find((candidate) => candidate.harness === session.harness)
    if (page !== undefined) page.rows.push(session)
  }
  return mergeRosterPage(pages, ROSTER_PAGE_SIZE)
}

function nextCursorForPage(readings: ReadSource[], page: ReturnType<typeof mergeRosterPage>) {
  const known = Object.fromEntries(
    readings.map(({ source, previous, discovery }) => [
      source.harness,
      [
        ...(previous?.known ?? []),
        ...(discovery === null || isDiscoveryError(discovery)
          ? []
          : discovery.rows.map((row) => row.id)),
      ],
    ]),
  )
  return encodeUnifiedRosterCursor(cursorWithKnown(page.cursor, known))
}

export async function listReply(
  sources: SessionSource[],
  ownership: {
    rememberDiscoveries: (sessions: { id: string; harness: string }[]) => void
  },
  {
    ticketLinks,
    archive,
    unread,
    request,
  }: {
    ticketLinks: SessionTicketLinkStore
    archive: SessionArchiveStore
    unread: SessionUnreadStore
    request: SessionListRequest
  },
) {
  const cursor = decodeUnifiedRosterCursor(request.cursor)
  if (cursor === null) return sessionError('invalid-request', request.requestId)
  const readings = await readSources(sources, cursor, request)
  const reply = replyFor(sources, readings, request.requestId)
  if (reply.type !== 'session.listed') return reply
  const page = pageFor(sources, readings, reply.sessions)
  ownership.rememberDiscoveries(page.sessions)
  // An archived Session is never in the active list (#1593): the Archive page asks for one
  // instead, on demand. The flag is Argo's own, so every harness's rows drop out the same way.
  const observed = await unread.project(page.sessions)
  const active = await withoutArchived(observed, archive)
  // The Session → Ticket link is Argo's own owned state, never a transcript fact, so it joins
  // in here rather than in any one Harness's discovery (CONTEXT.md L1 · Session → Ticket).
  const sessions = await Promise.all(
    active.map(async (session) => ({
      ...session,
      ticket: await ticketLinks.linkFor(session.id),
    })),
  )
  return {
    ...reply,
    sessions,
    nextCursor: nextCursorForPage(readings, page),
  }
}

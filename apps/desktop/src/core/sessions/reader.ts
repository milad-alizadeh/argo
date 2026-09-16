import {
  createInMemorySessionTicketLinkStore,
  type SessionTicketLinkStore,
} from '../tickets/session-links'
import type { SessionReader } from './bridge'
import {
  driveSessionError,
  isDriveCli,
  type SessionListRequest,
  type SessionRenameRequest,
  sessionError,
} from './contract'
import type { HeldFeed } from './feed-cache'
import type { FeedProjectionState } from './feed-incremental'
import type { Discovered } from './merge-discovery'
import { combineDiscoveries } from './merge-discovery'
import { type OwnerFor, type ReadContext, readFailure } from './read-declaration'
import { createFeedReader } from './read-session-feed'
import {
  archiveListRead,
  archiveSetWrite,
  delegationUsageRead,
  shellOutputRead,
  skillFileRead,
  workspaceFileRead,
} from './reads'
import { decodeRosterCursor } from './roster-cursor'
import type { SessionSource } from './session-source'
import { connectTicketReply, disconnectTicketReply } from './ticket-link-reader'

export type { FeedOverlay, SessionSource } from './session-source'

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

function createOwnerResolver(sources: SessionSource[]) {
  const owners = new Map<string, SessionSource>()
  const lastDiscoveredCli = new Map<string, string>()
  const managedOwner = (sessionId: string) =>
    sources.find((source) => source.managedSessions?.().some(({ id }) => id === sessionId))
  const ownerFor = async (sessionId: string) => {
    const managed = managedOwner(sessionId)
    if (managed !== undefined) return managed
    const cli = lastDiscoveredCli.get(sessionId)
    const discovered = cli === undefined ? undefined : sources.find((source) => source.cli === cli)
    if (discovered !== undefined) return discovered
    const known = owners.get(sessionId)
    if (known !== undefined) return known
    for (const source of sources) {
      if ((await source.readSessionFiles(sessionId).catch(() => null)) !== null) {
        owners.set(sessionId, source)
        return source
      }
    }
    return undefined
  }
  const rememberDiscoveries = (sessions: { id: string; cli: string }[]) => {
    lastDiscoveredCli.clear()
    for (const session of sessions) {
      if (!lastDiscoveredCli.has(session.id)) lastDiscoveredCli.set(session.id, session.cli)
    }
  }
  return {
    managed: (source: SessionSource, id: string) => managedOwner(id) === source,
    ownerFor,
    rememberDiscoveries,
  }
}

async function renameReply(ownerFor: OwnerFor, request: SessionRenameRequest) {
  const owner = await ownerFor(request.sessionId)
  if (owner === undefined) return sessionError('missing-session', request.requestId)
  if (owner.rename === undefined) {
    const cli = isDriveCli(owner.cli) ? owner.cli : 'claude'
    return driveSessionError('not-drivable', cli, request.requestId)
  }
  return owner.rename(request)
}

async function listReply(
  sources: SessionSource[],
  ownership: ReturnType<typeof createOwnerResolver>,
  { ticketLinks, request }: { ticketLinks: SessionTicketLinkStore; request: SessionListRequest },
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
  // The Session → Ticket link is Argo's own owned state, never a transcript fact, so it joins
  // in here rather than in any one CLI's discovery (CONTEXT.md L1 · Session → Ticket).
  const sessions = await Promise.all(
    reply.sessions.map(async (session) => ({
      ...session,
      ticket: await ticketLinks.linkFor(session.id),
    })),
  )
  return { ...reply, sessions }
}

// The reader learns a Session's owner from three facts, in this order: a managed Session a
// driver reports, the `cli` of the Session's row in the most recent discovery, and, if neither
// knows the Session, the first adapter whose chain read finds it. Once known, the owner is kept.
export function createSessionReader(
  sources: SessionSource[],
  ticketLinks: SessionTicketLinkStore = createInMemorySessionTicketLinkStore(),
): SessionReader {
  const feeds = new Map<string, HeldFeed>()
  const projections = new Map<string, FeedProjectionState>()
  const ownership = createOwnerResolver(sources)
  const feedReader = createFeedReader(ownership, feeds, projections)
  const reads: ReadContext = { sources, ownerFor: ownership.ownerFor }

  return {
    async ownerCliFor(sessionId) {
      const owner = await ownership.ownerFor(sessionId)
      return owner?.cli
    },
    listSessions: (request) => listReply(sources, ownership, { ticketLinks, request }),
    connectTicket: (request) => connectTicketReply(ticketLinks, request),
    disconnectTicket: (request) => disconnectTicketReply(ticketLinks, request),
    archiveList: (request) => archiveListRead(reads, request),
    archiveSet: (request) => archiveSetWrite(reads, request),
    readWorkspaceFile: (request) => workspaceFileRead(reads, request),
    readSkillFile: (request) => skillFileRead(reads, request),
    readSessionFeed: feedReader.readSessionFeed,
    cancelSessionFeed: feedReader.cancelSessionFeed,
    readShellOutput: (request) => shellOutputRead(reads, request),
    readDelegationUsage: (request) => delegationUsageRead(reads, request),
    renameSession: (request) => renameReply(ownership.ownerFor, request),
  }
}

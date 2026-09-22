import {
  driveSessionError,
  type SessionRenameRequest,
  type SessionUnreadFocusRequest,
  sessionError,
} from '@/domains/sessions/contract/ipc'
import { archiveListRead, archiveSetWrite } from '../archive'
import { createInMemorySessionArchiveStore, SessionArchiveStore } from '../archive'
import { SessionReader } from '../composition'
import { HeldFeed } from '../projection'
import { FeedProjectionState } from '../projection'
import { listReply } from '../projection'
import { createFeedReader } from '../projection'
import { delegationUsageRead, shellOutputRead, skillFileRead, workspaceFileRead } from '../projection'
import { searchRead } from '../projection'
import { connectTicketReply, disconnectTicketReply } from '../projection'
import { createInMemorySessionUnreadStore, SessionUnreadStore } from '../unread'
import {
  createInMemorySessionTicketLinkStore,
  type SessionTicketLinkStore,
} from '@/domains/tickets/main'
import type { OwnerFor, ReadContext } from './read-declaration'
import type { SessionSource } from './session-source'

export type { FeedOverlay, SessionSource } from './session-source'

type ReaderState = SessionArchiveStore & { unread?: SessionUnreadStore }

function createOwnerResolver(sources: SessionSource[]) {
  const owners = new Map<string, SessionSource>()
  const lastDiscoveredHarness = new Map<string, string>()
  const managedOwner = (sessionId: string) => {
    const managed = sources.filter((source) =>
      source.managedSessions?.().some(({ id }) => id === sessionId),
    )
    return managed.find((source) => source.readManagedFeed !== undefined) ?? managed[0]
  }
  const ownerFor = async (sessionId: string) => {
    const managed = managedOwner(sessionId)
    if (managed !== undefined) return managed
    const harness = lastDiscoveredHarness.get(sessionId)
    const discovered =
      harness === undefined ? undefined : sources.find((source) => source.harness === harness)
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
  const rememberDiscoveries = (sessions: { id: string; harness: string }[]) => {
    lastDiscoveredHarness.clear()
    for (const session of sessions) {
      if (!lastDiscoveredHarness.has(session.id)) {
        lastDiscoveredHarness.set(session.id, session.harness)
      }
    }
  }
  return {
    managed: (source: SessionSource, id: string) => managedOwner(id) === source,
    ownerFor,
    async sessionCwdFor(sessionId: string) {
      const owner = await ownerFor(sessionId)
      if (owner === undefined) return undefined
      const discovery = await owner.discoverSessions()
      return discovery.rows.find((session) => session.id === sessionId)?.cwd ?? undefined
    },
    rememberDiscoveries,
  }
}

async function renameReply(ownerFor: OwnerFor, request: SessionRenameRequest) {
  const owner = await ownerFor(request.sessionId)
  if (owner === undefined) return sessionError('missing-session', request.requestId)
  if (owner.rename === undefined) {
    return driveSessionError('not-drivable', owner.harness, request.requestId)
  }
  return owner.rename(request)
}

// The reader learns a Session's owner from three facts, in this order: a managed Session a
// driver reports, the `harness` of the Session's row in the most recent discovery, and, if neither
// knows the Session, the first adapter whose chain read finds it. Once known, the owner is kept.
export function createSessionReader(
  sources: SessionSource[],
  ticketLinks: SessionTicketLinkStore = createInMemorySessionTicketLinkStore(),
  state: ReaderState = createInMemorySessionArchiveStore(),
): SessionReader {
  const archive = state
  const unread = state.unread ?? createInMemorySessionUnreadStore()
  const feeds = new Map<string, HeldFeed>()
  const projections = new Map<string, FeedProjectionState>()
  const ownership = createOwnerResolver(sources)
  const feedReader = createFeedReader(ownership, feeds, projections)
  const reads: ReadContext = { sources, ownerFor: ownership.ownerFor, archive, unread }

  return {
    async ownerHarnessFor(sessionId) {
      const owner = await ownership.ownerFor(sessionId)
      return owner?.harness
    },
    sessionCwdFor: ownership.sessionCwdFor,
    listSessions: (request) =>
      listReply(sources, ownership, { ticketLinks, archive, unread, request }),
    connectTicket: (request) => connectTicketReply(ticketLinks, request),
    disconnectTicket: (request) => disconnectTicketReply(ticketLinks, request),
    archiveList: (request) => archiveListRead(reads, request),
    archiveSet: (request) => archiveSetWrite(reads, request),
    search: (request) => searchRead(reads, request),
    readWorkspaceFile: (request) => workspaceFileRead(reads, request),
    readSkillFile: (request) => skillFileRead(reads, request),
    readSessionFeed: feedReader.readSessionFeed,
    cancelSessionFeed: feedReader.cancelSessionFeed,
    isFeedReadActive: feedReader.isFeedReadActive,
    readShellOutput: (request) => shellOutputRead(reads, request),
    readSubagentUsage: (request) => delegationUsageRead(reads, request),
    renameSession: (request) => renameReply(ownership.ownerFor, request),
    async focusSessionUnread(request: SessionUnreadFocusRequest) {
      const focused = await unread.focus(request.sessionId)
      return focused
        ? {
            version: 1,
            type: 'session.unread.focused',
            requestId: request.requestId,
            sessionId: request.sessionId,
          }
        : sessionError('internal-error', request.requestId)
    },
  }
}

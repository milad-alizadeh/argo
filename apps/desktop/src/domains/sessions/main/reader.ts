import {
  driveSessionError,
  isDriveCli,
  type SessionRenameRequest,
  sessionError,
} from '@/domains/sessions/contract/contract'
import { archiveListRead, archiveSetWrite } from '@/domains/sessions/main/archive-reads'
import {
  createInMemorySessionArchiveStore,
  type SessionArchiveStore,
} from '@/domains/sessions/main/archive-store'
import type { SessionReader } from '@/domains/sessions/main/bridge'
import type { HeldFeed } from '@/domains/sessions/main/feed-cache'
import type { FeedProjectionState } from '@/domains/sessions/main/feed-incremental'
import type { OwnerFor, ReadContext } from '@/domains/sessions/main/read-declaration'
import { listReply } from '@/domains/sessions/main/read-roster'
import { createFeedReader } from '@/domains/sessions/main/read-session-feed'
import {
  delegationUsageRead,
  shellOutputRead,
  skillFileRead,
  workspaceFileRead,
} from '@/domains/sessions/main/reads'
import { searchRead } from '@/domains/sessions/main/search-reads'
import type { SessionSource } from '@/domains/sessions/main/session-source'
import {
  connectTicketReply,
  disconnectTicketReply,
} from '@/domains/sessions/main/ticket-link-reader'
import {
  createInMemorySessionTicketLinkStore,
  type SessionTicketLinkStore,
} from '@/domains/tickets/main/session-links'

export type { FeedOverlay, SessionSource } from '@/domains/sessions/main/session-source'

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

// The reader learns a Session's owner from three facts, in this order: a managed Session a
// driver reports, the `cli` of the Session's row in the most recent discovery, and, if neither
// knows the Session, the first adapter whose chain read finds it. Once known, the owner is kept.
export function createSessionReader(
  sources: SessionSource[],
  ticketLinks: SessionTicketLinkStore = createInMemorySessionTicketLinkStore(),
  archive: SessionArchiveStore = createInMemorySessionArchiveStore(),
): SessionReader {
  const feeds = new Map<string, HeldFeed>()
  const projections = new Map<string, FeedProjectionState>()
  const ownership = createOwnerResolver(sources)
  const feedReader = createFeedReader(ownership, feeds, projections)
  const reads: ReadContext = { sources, ownerFor: ownership.ownerFor, archive }

  return {
    async ownerCliFor(sessionId) {
      const owner = await ownership.ownerFor(sessionId)
      return owner?.cli
    },
    listSessions: (request) => listReply(sources, ownership, { ticketLinks, archive, request }),
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
    readDelegationUsage: (request) => delegationUsageRead(reads, request),
    renameSession: (request) => renameReply(ownership.ownerFor, request),
  }
}

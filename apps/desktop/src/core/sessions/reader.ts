import {
  createInMemorySessionTicketLinkStore,
  type SessionTicketLinkStore,
} from '../tickets/session-links'
import type { SessionReader } from './bridge'
import {
  driveSessionError,
  isDriveCli,
  sessionError,
  sessionListRequestSchema,
  sessionRenameRequestSchema,
} from './contract'
import type { HeldFeed } from './feed-cache'
import type { FeedProjectionState } from './feed-incremental'
import type { Discovered } from './merge-discovery'
import { combineDiscoveries } from './merge-discovery'
import { archiveListReply } from './read-archive-list'
import { delegationUsageReply, type OwnerFor, shellOutputReply } from './read-background-work'
import { workspaceFileReply } from './read-file-request'
import { readFailure, versionFailure } from './read-request'
import { createFeedReader } from './read-session-feed'
import type { SessionSource } from './session-source'
import { connectTicketReply, disconnectTicketReply } from './ticket-link-reader'

export type { FeedOverlay, SessionSource } from './session-source'

async function discoverFromSource(source: SessionSource, requestId: string): Promise<Discovered> {
  try {
    const discovery = await source.discoverSessions()
    const isLockedElsewhere = source.isLockedElsewhere
    if (isLockedElsewhere === undefined) return discovery
    return {
      ...discovery,
      rows: discovery.rows.map((row) => ({ ...row, locked: isLockedElsewhere(row.id) })),
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

async function renameReply(ownerFor: OwnerFor, value: unknown) {
  if (versionFailure(value)) return sessionError('unsupported-version', null)
  const parsed = sessionRenameRequestSchema.safeParse(value)
  if (!parsed.success) return sessionError('invalid-request', null)
  const owner = await ownerFor(parsed.data.sessionId)
  if (owner === undefined) return sessionError('missing-session', parsed.data.requestId)
  if (owner.rename === undefined) {
    const cli = isDriveCli(owner.cli) ? owner.cli : 'claude'
    return driveSessionError('not-drivable', cli, parsed.data.requestId)
  }
  return owner.rename(parsed.data)
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

  return {
    async ownerCliFor(sessionId) {
      const owner = await ownership.ownerFor(sessionId)
      return owner?.cli
    },
    async listSessions(value) {
      if (versionFailure(value)) return sessionError('unsupported-version', null)
      const parsed = sessionListRequestSchema.safeParse(value)
      if (!parsed.success) return sessionError('invalid-request', null)
      const discovered = await Promise.all(
        sources.map((source) => discoverFromSource(source, parsed.data.requestId)),
      )
      const reply = combineDiscoveries(discovered, parsed.data.requestId)
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
    },
    connectTicket: (request) => connectTicketReply(ticketLinks, request),
    disconnectTicket: (request) => disconnectTicketReply(ticketLinks, request),
    archiveList: (value) => archiveListReply(sources, value),
    readWorkspaceFile: (value) => workspaceFileReply(ownership.ownerFor, value),
    readSessionFeed: feedReader.readSessionFeed,
    cancelSessionFeed: feedReader.cancelSessionFeed,
    readShellOutput: (value) => shellOutputReply(ownership.ownerFor, value),
    readDelegationUsage: (value) => delegationUsageReply(ownership.ownerFor, value),
    renameSession: (value) => renameReply(ownership.ownerFor, value),
  }
}

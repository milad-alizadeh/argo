// The one Session reader in the main process (#2025). It parses each request once, at this
// seam, and returns a reply typed by the contract's own schemas; nothing downstream parses or
// casts again. Each CLI registers a `SessionSource` here rather than shared code branching on a
// `cli` name (ADR-0021, ADR-0024).
import { isRecord } from '../../boundary'
import type { SessionReader } from './bridge'
import {
  sessionError,
  sessionFeedRequestSchema,
  sessionListRequestSchema,
  sessionRenameRequestSchema,
} from './contract'
import type { HeldFeed } from './feed-cache'
import type { Discovered } from './merge-discovery'
import { combineDiscoveries } from './merge-discovery'
import { readFeedWithOverlay } from './read-owned-feed'
import type { SessionSource } from './session-source'

export type { FeedOverlay, SessionSource } from './session-source'

function versionFailure(value: unknown) {
  return isRecord(value) && typeof value.version === 'number' && value.version !== 1
}

function readFailure(error: unknown) {
  if (isRecord(error) && (error.code === 'EACCES' || error.code === 'EPERM')) return 'access-denied'
  if (isRecord(error) && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) {
    return 'transcripts-unavailable'
  }
  return 'internal-error'
}

async function discoverFromSource(source: SessionSource, requestId: string): Promise<Discovered> {
  try {
    return await source.discoverSessions()
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

// The reader learns a Session's owner from three facts, in this order: a managed Session a
// driver reports, the `cli` of the Session's row in the most recent discovery, and, if neither
// knows the Session, the first adapter whose chain read finds it. Once known, the owner is kept.
export function createSessionReader(sources: SessionSource[]): SessionReader {
  const feeds = new Map<string, HeldFeed>()
  const ownership = createOwnerResolver(sources)

  return {
    async listSessions(value) {
      if (versionFailure(value)) return sessionError('unsupported-version', null)
      const parsed = sessionListRequestSchema.safeParse(value)
      if (!parsed.success) return sessionError('invalid-request', null)
      const discovered = await Promise.all(
        sources.map((source) => discoverFromSource(source, parsed.data.requestId)),
      )
      const reply = combineDiscoveries(discovered, parsed.data.requestId)
      if (reply.type === 'session.listed') {
        ownership.rememberDiscoveries(reply.sessions)
      }
      return reply
    },
    async readSessionFeed(value) {
      if (versionFailure(value)) return sessionError('unsupported-version', null)
      const parsed = sessionFeedRequestSchema.safeParse(value)
      if (!parsed.success) return sessionError('invalid-request', null)
      try {
        const owner = await ownership.ownerFor(parsed.data.sessionId)
        if (owner === undefined) return sessionError('missing-session', parsed.data.requestId)
        const managed = ownership.managed(owner, parsed.data.sessionId)
        return await readFeedWithOverlay({ source: owner, feeds, managed }, parsed.data)
      } catch (error) {
        return sessionError(readFailure(error), parsed.data.requestId)
      }
    },
    async renameSession(value) {
      if (versionFailure(value)) return sessionError('unsupported-version', null)
      const parsed = sessionRenameRequestSchema.safeParse(value)
      if (!parsed.success) return sessionError('invalid-request', null)
      const owner = await ownership.ownerFor(parsed.data.sessionId)
      if (owner === undefined) return sessionError('missing-session', parsed.data.requestId)
      if (owner.rename === undefined) return sessionError('not-drivable', parsed.data.requestId)
      return owner.rename(parsed.data)
    },
  }
}

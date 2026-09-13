// The one Session reader in the main process (#2025). It parses each request once, at this
// seam, and returns a reply typed by the contract's own schemas; nothing downstream parses or
// casts again. Each CLI registers a `SessionSource` here rather than shared code branching on a
// `cli` name (ADR-0021, ADR-0024).
import { isRecord } from '../../boundary'
import type { SessionReader } from './bridge'
import { sessionError, sessionFeedRequestSchema, sessionListRequestSchema } from './contract'
import type { HeldFeed } from './feed-cache'
import type { Discovered } from './merge-discovery'
import { combineDiscoveries, mergeManagedRoster } from './merge-discovery'
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
    const discovery = await source.discoverSessions()
    return mergeManagedRoster(discovery, source.managedSessions?.() ?? [])
  } catch (error) {
    return { error: sessionError(readFailure(error), requestId) }
  }
}

// The reader learns a Session's owner from three facts, in this order: a managed Session a
// driver reports, the `cli` of the Session's row in the most recent discovery, and, if neither
// knows the Session, the first adapter whose chain read finds it. Once known, the owner is kept.
export function createSessionReader(sources: SessionSource[]): SessionReader {
  const feeds = new Map<string, HeldFeed>()
  const owners = new Map<string, SessionSource>()
  const lastDiscoveredCli = new Map<string, string>()

  function managedOwner(sessionId: string): SessionSource | undefined {
    return sources.find((source) => source.managedSessions?.().some(({ id }) => id === sessionId))
  }

  async function probeOwner(sessionId: string): Promise<SessionSource | undefined> {
    for (const source of sources) {
      const chain = await source.readSessionFiles(sessionId).catch(() => null)
      if (chain !== null) return source
    }
    return undefined
  }

  async function ownerFor(sessionId: string): Promise<SessionSource | undefined> {
    const known = owners.get(sessionId)
    if (known !== undefined) return known
    const managed = managedOwner(sessionId)
    if (managed !== undefined) {
      owners.set(sessionId, managed)
      return managed
    }
    const cli = lastDiscoveredCli.get(sessionId)
    const bySource = cli === undefined ? undefined : sources.find((source) => source.cli === cli)
    if (bySource !== undefined) {
      owners.set(sessionId, bySource)
      return bySource
    }
    const probed = await probeOwner(sessionId)
    if (probed !== undefined) owners.set(sessionId, probed)
    return probed
  }

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
        lastDiscoveredCli.clear()
        for (const session of reply.sessions) lastDiscoveredCli.set(session.id, session.cli)
      }
      return reply
    },
    async readSessionFeed(value) {
      if (versionFailure(value)) return sessionError('unsupported-version', null)
      const parsed = sessionFeedRequestSchema.safeParse(value)
      if (!parsed.success) return sessionError('invalid-request', null)
      try {
        const owner = await ownerFor(parsed.data.sessionId)
        if (owner === undefined) return sessionError('missing-session', parsed.data.requestId)
        const managed =
          owner.managedSessions?.().some(({ id }) => id === parsed.data.sessionId) ?? false
        return await readFeedWithOverlay({ source: owner, feeds, managed }, parsed.data)
      } catch (error) {
        return sessionError(readFailure(error), parsed.data.requestId)
      }
    },
  }
}

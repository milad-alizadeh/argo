import { createHash } from 'node:crypto'

import { isRecord } from '../../boundary'
import type { SessionReader } from './bridge'
import type { SessionChain } from './chains'
import {
  type SessionFeedRequest,
  sessionError,
  sessionFeedRequestSchema,
  sessionListRequestSchema,
} from './contract'
import { cachedReply, feedReply, type HeldFeed, keepFeed, stableChain } from './feed-cache'
import type { SessionFeedRow, SessionRosterRow } from './models'

type Discovery = {
  rows: SessionRosterRow[]
  filesFound: number
  filesRead: number
  filesUnreadable: number
}

type TranscriptSessionSource = {
  discoverSessions: () => Promise<Discovery>
  readSessionFiles: (sessionId: string) => Promise<SessionChain | null>
  projectFeed: (chain: SessionChain) => SessionFeedRow[]
}

// A managed Session is driven in memory before its CLI ever writes a transcript, so an adapter's
// discovery sweep alone can miss it, or hold a stale posture for one it has already found.
export function mergeManagedRoster(discovered: Discovery, managed: SessionRosterRow[]): Discovery {
  const managedById = new Map(managed.map((session) => [session.id, session]))
  const observed = discovered.rows.map((session) => {
    const held = managedById.get(session.id)
    return held === undefined
      ? session
      : {
          ...session,
          posture: held.posture,
          compactionStartedAt: held.compactionStartedAt,
          compactionPercentage: held.compactionPercentage,
          compactionTokens: held.compactionTokens,
        }
  })
  const unobserved = managed.filter(
    (session) => !discovered.rows.some(({ id }) => id === session.id),
  )
  return { ...discovered, rows: [...observed, ...unobserved] }
}

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

type FeedReadOptions = {
  source: TranscriptSessionSource
  feeds: Map<string, HeldFeed>
  value: SessionFeedRequest
}

function feedRevision(chainId: string, stamps: string) {
  return createHash('sha256').update(JSON.stringify({ chainId, stamps })).digest('hex')
}

async function readFeed({ source, feeds, value }: FeedReadOptions) {
  const held = feeds.get(value.sessionId)
  const cached = await cachedReply(value, held)
  if (cached !== null) {
    if (held !== undefined) keepFeed(feeds, value.sessionId, held)
    return cached
  }
  const stable = await stableChain(source, value.sessionId, held?.paths ?? [])
  if (stable === null) return sessionError('missing-session', value.requestId)
  const { chain, stamps } = stable
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

export function createTranscriptSessionReader(source: TranscriptSessionSource): SessionReader {
  const feeds = new Map<string, HeldFeed>()
  return {
    async listSessions(value) {
      if (versionFailure(value)) return sessionError('unsupported-version', null)
      const parsed = sessionListRequestSchema.safeParse(value)
      if (!parsed.success) return sessionError('invalid-request', null)
      try {
        const discovery = await source.discoverSessions()
        return {
          version: 1,
          type: 'session.listed',
          requestId: parsed.data.requestId,
          sessions: discovery.rows,
          filesFound: discovery.filesFound,
          filesRead: discovery.filesRead,
          filesUnreadable: discovery.filesUnreadable,
        }
      } catch (error) {
        return sessionError(readFailure(error), parsed.data.requestId)
      }
    },
    async readSessionFeed(value) {
      if (versionFailure(value)) return sessionError('unsupported-version', null)
      const parsed = sessionFeedRequestSchema.safeParse(value)
      if (!parsed.success) return sessionError('invalid-request', null)
      try {
        return await readFeed({ source, feeds, value: parsed.data })
      } catch (error) {
        return sessionError(readFailure(error), parsed.data.requestId)
      }
    },
  }
}

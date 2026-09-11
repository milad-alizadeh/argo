import { isRecord } from '../../boundary'
import type { SessionReader } from './bridge'
import type { SessionChain } from './chains'
import {
  isSessionFeedRequest,
  isSessionListRequest,
  type SessionFeedRequest,
  sessionError,
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
  revisions: { next: number }
  value: SessionFeedRequest
}

async function readFeed({ source, feeds, revisions, value }: FeedReadOptions) {
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
  const revision = `feed-${++revisions.next}`
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
  const revisions = { next: 0 }
  return {
    async listSessions(value) {
      if (versionFailure(value)) return sessionError('unsupported-version', null)
      if (!isSessionListRequest(value)) return sessionError('invalid-request', null)
      try {
        const discovery = await source.discoverSessions()
        return {
          version: 1,
          type: 'session.listed',
          requestId: value.requestId,
          sessions: discovery.rows,
          filesFound: discovery.filesFound,
          filesRead: discovery.filesRead,
          filesUnreadable: discovery.filesUnreadable,
        }
      } catch (error) {
        return sessionError(readFailure(error), value.requestId)
      }
    },
    async readSessionFeed(value) {
      if (versionFailure(value)) return sessionError('unsupported-version', null)
      if (!isSessionFeedRequest(value)) return sessionError('invalid-request', null)
      try {
        return await readFeed({ source, feeds, revisions, value })
      } catch (error) {
        return sessionError(readFailure(error), value.requestId)
      }
    },
  }
}

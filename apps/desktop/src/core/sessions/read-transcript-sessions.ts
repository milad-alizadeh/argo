import { isRecord } from '../../boundary'
import type { SessionReader } from './bridge'
import type { SessionChain } from './chains'
import { isSessionFeedRequest, isSessionListRequest, sessionError } from './contract'
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

export function createTranscriptSessionReader(source: TranscriptSessionSource): SessionReader {
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
        const chain = await source.readSessionFiles(value.sessionId)
        if (chain === null) return sessionError('missing-session', value.requestId)
        return {
          version: 1,
          type: 'session.feed.read',
          requestId: value.requestId,
          sessionId: value.sessionId,
          chainId: chain.id,
          rows: source.projectFeed(chain),
        }
      } catch (error) {
        return sessionError(readFailure(error), value.requestId)
      }
    },
  }
}

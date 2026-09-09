// The two main-process actions behind the Session contract. Everything they touch is read-only:
// this slice observes transcripts and writes nothing back to them.
import { isRecord } from '../boundary'
import {
  isSessionFeedRequest,
  isSessionListRequest,
  type SessionFeedReply,
  type SessionListReply,
  sessionError,
} from './contract'
import { discoverSessions, readSessionFiles } from './discover'
import { projectFeed } from './feed'

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

export async function listSessions(value: unknown, root: string): Promise<SessionListReply> {
  if (versionFailure(value)) return sessionError('unsupported-version', null)
  if (!isSessionListRequest(value)) return sessionError('invalid-request', null)
  try {
    const discovery = await discoverSessions(root)
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
}

export async function readFeed(value: unknown, root: string): Promise<SessionFeedReply> {
  if (versionFailure(value)) return sessionError('unsupported-version', null)
  if (!isSessionFeedRequest(value)) return sessionError('invalid-request', null)
  try {
    const chain = await readSessionFiles(root, value.sessionId)
    if (chain === null) return sessionError('missing-session', value.requestId)
    return {
      version: 1,
      type: 'session.feed.read',
      requestId: value.requestId,
      sessionId: value.sessionId,
      chainId: chain.id,
      rows: projectFeed(chain),
    }
  } catch (error) {
    return sessionError(readFailure(error), value.requestId)
  }
}

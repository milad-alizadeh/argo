// Reading a Session's own Feed, or one Subagent's (#1582), and cancelling a read still in flight
// when the caller switches away before it answers (#2102). The Feed is the one read the
// declarations in `reads.ts` do not cover, because its reply type turns on what changed; #2279's
// second candidate folds it in behind one Feed projection.
import {
  type SessionFeedCancelRequest,
  type SessionFeedReply,
  type SessionFeedRequest,
  sessionError,
} from '@/domains/sessions/contract/ipc'
import { type OwnerFor, readFailure } from '../../observation/reader/read-declaration'
import { readFeedWithOverlay, readOwnedFeed } from '../../observation/reader/read-owned-feed'
import type { SessionSource } from '../../observation/reader/reader'
import { disposeFeed, type HeldFeed } from './feed-cache'
import type { FeedProjectionState } from './feed-incremental'

type Ownership = {
  ownerFor: OwnerFor
  managed: (source: SessionSource, id: string) => boolean
}

// One in-flight read per Session, tracked so a switch away from it (#2102) can abort the settle
// loop instead of letting it run to its bound with nothing left to draw the answer.
function createFeedReads() {
  const reads = new Map<string, AbortController>()
  return {
    // A later read for the same Session (a fresh poll, a retry) supersedes an earlier one.
    start(sessionId: string): AbortController {
      reads.get(sessionId)?.abort()
      const controller = new AbortController()
      reads.set(sessionId, controller)
      return controller
    },
    finish(sessionId: string, controller: AbortController) {
      if (reads.get(sessionId) === controller) reads.delete(sessionId)
    },
    cancel(sessionId: string) {
      reads.get(sessionId)?.abort()
    },
    // A selected Feed still in flight, so background indexing (#2373) can pause rather than race a
    // read for the files it is reindexing.
    isActive: () => reads.size > 0,
  }
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError'
}

// A Subagent's Feed is read through the same path as a Session's: the owner answers with the
// Subagent's chain in place of its own, and nothing else about the read changes. A driver's live
// overlay is the Session's turn and says nothing about a Subagent, so no overlay is applied.
function delegationSource(owner: SessionSource, subagentId: string): SessionSource {
  return {
    ...owner,
    overlayFor: undefined,
    readSessionFiles: async (sessionId) =>
      (await owner.readSubagentFiles?.(sessionId, subagentId)) ?? null,
  }
}

async function cancelFeed({
  ownership,
  feeds,
  projections,
  reads,
  request,
}: {
  ownership: Ownership
  feeds: Map<string, HeldFeed>
  projections: Map<string, FeedProjectionState>
  reads: ReturnType<typeof createFeedReads>
  request: SessionFeedCancelRequest
}) {
  const { sessionId } = request
  reads.cancel(sessionId)
  disposeFeed({ feeds, projections }, sessionId)
  const owner = await ownership.ownerFor(sessionId)
  owner?.disposeFullRecords?.(sessionId)
  return {
    version: 1 as const,
    type: 'session.accepted' as const,
    requestId: request.requestId,
    sessionId,
  }
}

function readDirectManagedFeed(source: SessionSource, request: SessionFeedRequest) {
  const feed = source.readManagedFeed?.(request.sessionId)
  if (feed === undefined) return undefined
  if (feed === null) return sessionError('missing-session', request.requestId)
  if (feed.revision === request.revision) {
    return {
      version: 1 as const,
      type: 'session.feed.unchanged' as const,
      requestId: request.requestId,
      sessionId: request.sessionId,
      chainId: feed.chainId,
      revision: feed.revision,
    }
  }
  return {
    version: 1 as const,
    type: 'session.feed.read' as const,
    requestId: request.requestId,
    sessionId: request.sessionId,
    chainId: feed.chainId,
    revision: feed.revision,
    rows: feed.rows,
  }
}

export function createFeedReader(
  ownership: Ownership,
  feeds: Map<string, HeldFeed>,
  projections: Map<string, FeedProjectionState>,
) {
  const reads = createFeedReads()
  return {
    async readSessionFeed(request: SessionFeedRequest) {
      const { sessionId, subagentId } = request
      const controller = reads.start(sessionId)
      try {
        const owner = await ownership.ownerFor(sessionId)
        if (owner === undefined) return sessionError('missing-session', request.requestId)
        let reply: SessionFeedReply
        if (subagentId !== null) {
          const context = {
            source: delegationSource(owner, subagentId),
            feeds,
            projections,
            managed: false,
            key: `${sessionId}#${subagentId}`,
            signal: controller.signal,
          }
          reply = await readOwnedFeed(context, request)
        } else {
          const direct = readDirectManagedFeed(owner, request)
          if (direct !== undefined) reply = direct
          else {
            const managed = ownership.managed(owner, sessionId)
            reply = await readFeedWithOverlay(
              {
                source: owner,
                feeds,
                projections,
                managed,
                key: sessionId,
                signal: controller.signal,
              },
              request,
            )
          }
        }
        // A cancel that lands after the owner lookup but before this settles still wins: the
        // caller switched away and no longer wants an answer that finished instead of stopping.
        if (controller.signal.aborted) return sessionError('cancelled', request.requestId)
        return reply
      } catch (error) {
        // A cancelled caller wins even when an adapter surfaces a non-AbortError interruption.
        if (controller.signal.aborted || isAbortError(error)) {
          return sessionError('cancelled', request.requestId)
        }
        return sessionError(readFailure(error), request.requestId)
      } finally {
        reads.finish(sessionId, controller)
      }
    },
    cancelSessionFeed: (request: SessionFeedCancelRequest) =>
      cancelFeed({ ownership, feeds, projections, reads, request }),
    isFeedReadActive: reads.isActive,
  }
}

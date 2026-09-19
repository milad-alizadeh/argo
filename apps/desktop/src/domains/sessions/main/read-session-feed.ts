// Reading a Session's own Feed, or one Subagent's (#1582), and cancelling a read still in flight
// when the caller switches away before it answers (#2102). The Feed is the one read the
// declarations in `reads.ts` do not cover, because its reply type turns on what changed; #2279's
// second candidate folds it in behind one Feed projection.
import {
  type SessionFeedCancelRequest,
  type SessionFeedReply,
  type SessionFeedRequest,
  sessionError,
} from '../contract/contract'
import { disposeFeed, type HeldFeed } from './feed-cache'
import type { FeedProjectionState } from './feed-incremental'
import { createFeedReads, isAbortError } from './feed-reads'
import { type OwnerFor, readFailure } from './read-declaration'
import { readFeedWithOverlay, readOwnedFeed } from './read-owned-feed'
import type { SessionSource } from './session-source'

type Ownership = {
  ownerFor: OwnerFor
  managed: (source: SessionSource, id: string) => boolean
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

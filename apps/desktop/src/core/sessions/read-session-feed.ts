// Reading a Session's own Feed, or one Subagent's (#1582), and cancelling a read still in flight
// when the caller switches away before it answers (#2102): split out of reader.ts to stay under
// the file-length gate.
import {
  type SessionFeedReply,
  sessionError,
  sessionFeedCancelRequestSchema,
  sessionFeedRequestSchema,
} from './contract'
import { disposeFeed, type HeldFeed } from './feed-cache'
import type { FeedProjectionState } from './feed-incremental'
import { createFeedReads, isAbortError } from './feed-reads'
import { delegationSource, type OwnerFor } from './read-background-work'
import { readFeedWithOverlay, readOwnedFeed } from './read-owned-feed'
import { readFailure, versionFailure } from './read-request'
import type { SessionSource } from './session-source'

type Ownership = {
  ownerFor: OwnerFor
  managed: (source: SessionSource, id: string) => boolean
}

async function cancelFeed({
  ownership,
  feeds,
  projections,
  reads,
  value,
}: {
  ownership: Ownership
  feeds: Map<string, HeldFeed>
  projections: Map<string, FeedProjectionState>
  reads: ReturnType<typeof createFeedReads>
  value: unknown
}) {
  if (versionFailure(value)) return sessionError('unsupported-version', null)
  const parsed = sessionFeedCancelRequestSchema.safeParse(value)
  if (!parsed.success) return sessionError('invalid-request', null)
  const { sessionId } = parsed.data
  reads.cancel(sessionId)
  disposeFeed({ feeds, projections }, sessionId)
  const owner = await ownership.ownerFor(sessionId)
  owner?.disposeFullRecords?.(sessionId)
  return {
    version: 1 as const,
    type: 'session.accepted' as const,
    requestId: parsed.data.requestId,
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
    async readSessionFeed(value: unknown) {
      if (versionFailure(value)) return sessionError('unsupported-version', null)
      const parsed = sessionFeedRequestSchema.safeParse(value)
      if (!parsed.success) return sessionError('invalid-request', null)
      const { sessionId, delegationId } = parsed.data
      const controller = reads.start(sessionId)
      try {
        const owner = await ownership.ownerFor(sessionId)
        if (owner === undefined) return sessionError('missing-session', parsed.data.requestId)
        let reply: SessionFeedReply
        if (delegationId !== null) {
          const source = delegationSource(owner, delegationId)
          const key = `${sessionId}#${delegationId}`
          const context = {
            source,
            feeds,
            projections,
            managed: false,
            key,
            signal: controller.signal,
          }
          reply = await readOwnedFeed(context, parsed.data)
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
            parsed.data,
          )
        }
        // A cancel that lands after the owner lookup but before this settles still wins: the
        // caller switched away and no longer wants an answer that finished instead of stopping.
        if (controller.signal.aborted) return sessionError('cancelled', parsed.data.requestId)
        return reply
      } catch (error) {
        // A cancelled caller wins even when an adapter surfaces a non-AbortError interruption.
        if (controller.signal.aborted || isAbortError(error)) {
          return sessionError('cancelled', parsed.data.requestId)
        }
        return sessionError(readFailure(error), parsed.data.requestId)
      } finally {
        reads.finish(sessionId, controller)
      }
    },
    cancelSessionFeed: (value: unknown) =>
      cancelFeed({ ownership, feeds, projections, reads, value }),
  }
}

// Feed read and cancel (#2102), split out of reader.ts to stay under the file-length gate. A
// cancel aborts the settle loop a switched-away-from read is still running instead of letting it
// run to its bound with nothing left to draw the answer.
import { sessionError, sessionFeedCancelRequestSchema, sessionFeedRequestSchema } from './contract'
import type { HeldFeed } from './feed-cache'
import { createFeedReads, isAbortError } from './feed-reads'
import { readFeedWithOverlay } from './read-owned-feed'
import { readFailure, versionFailure } from './request-validation'
import type { SessionSource } from './session-source'

type Ownership = {
  ownerFor: (sessionId: string) => Promise<SessionSource | undefined>
  managed: (source: SessionSource, sessionId: string) => boolean
}

export function createFeedHandlers(ownership: Ownership) {
  const feeds = new Map<string, HeldFeed>()
  const reads = createFeedReads()
  return {
    async readSessionFeed(value: unknown) {
      if (versionFailure(value)) return sessionError('unsupported-version', null)
      const parsed = sessionFeedRequestSchema.safeParse(value)
      if (!parsed.success) return sessionError('invalid-request', null)
      const { sessionId, requestId } = parsed.data
      const controller = reads.start(sessionId)
      try {
        const owner = await ownership.ownerFor(sessionId)
        if (owner === undefined) return sessionError('missing-session', requestId)
        const managed = ownership.managed(owner, sessionId)
        return await readFeedWithOverlay(
          { source: owner, feeds, managed, signal: controller.signal },
          parsed.data,
        )
      } catch (error) {
        if (isAbortError(error)) return sessionError('cancelled', requestId)
        return sessionError(readFailure(error), requestId)
      } finally {
        reads.finish(sessionId, controller)
      }
    },
    async cancelSessionFeed(value: unknown) {
      if (versionFailure(value)) return sessionError('unsupported-version', null)
      const parsed = sessionFeedCancelRequestSchema.safeParse(value)
      if (!parsed.success) return sessionError('invalid-request', null)
      reads.cancel(parsed.data.sessionId)
      return {
        version: 1 as const,
        type: 'session.accepted' as const,
        requestId: parsed.data.requestId,
        sessionId: parsed.data.sessionId,
      }
    },
  }
}

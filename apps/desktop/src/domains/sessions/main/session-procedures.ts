import { initTRPC } from '@trpc/server'
import { type ActorRefFrom, waitFor } from 'xstate'
import { readClaudeHistory } from '@/harnesses/claude/session/claude-history'
import {
  type codexAppServerMachine,
  requestCodexAppServer,
} from '@/harnesses/codex/app-server/codex-app-server-machine'
import { readCodexHistory } from '@/harnesses/codex/session/codex-history'
import type { DurableDatabase } from '@/platform/main/storage/durable-database'
import {
  type SessionAvailability,
  type SessionHistoryEntry,
  sessionFeedInputSchema,
  sessionFeedOutputSchema,
} from '../contract/session-history'
import {
  sessionEnsureInputSchema,
  sessionEnsureOutputSchema,
  sessionGetInputSchema,
  sessionGetOutputSchema,
  sessionListInputSchema,
  sessionListOutputSchema,
} from '../contract/session-list'
import { sessionAcceptedOutputSchema, sessionSubmitInputSchema } from '../contract/session-start'
import type { SessionSupervisorActor } from './live/session-supervisor-machine'
import {
  findSessionByVendorIdentity,
  readSession,
  readSessionIdentity,
  readSessionList,
} from './storage/session-records'
import type { SessionSyncActors } from './sync/session-sync-status'

const t = initTRPC.create()

export function sessionSubmitProcedure(supervisor: SessionSupervisorActor) {
  return t.procedure
    .input(sessionSubmitInputSchema)
    .output(sessionAcceptedOutputSchema)
    .mutation(
      ({ input }) =>
        new Promise<{ sessionId: string }>((resolve, reject) => {
          const reply = { resolve, reject }
          if (input.sessionId === null) {
            if (input.pendingId === null || input.projectId === null)
              throw new Error('A new Session requires a Project and pending identity.')
            supervisor.send({
              type: 'Start',
              input: { ...input, projectId: input.projectId },
              pendingId: input.pendingId,
              reply,
            })
          } else
            supervisor.send({
              type: 'Send',
              input: { ...input, sessionId: input.sessionId },
              reply,
            })
        }),
    )
}

export function sessionListProcedure(database: DurableDatabase) {
  return t.procedure
    .input(sessionListInputSchema)
    .output(sessionListOutputSchema)
    .query(({ input }) => sessionListOutputSchema.parse(readSessionList(database, input)))
}

export function sessionGetProcedure(database: DurableDatabase) {
  return t.procedure
    .input(sessionGetInputSchema)
    .output(sessionGetOutputSchema)
    .query(({ input }) => readSession(database, input.argoId))
}

export function sessionEnsureProcedure(database: DurableDatabase, sync: SessionSyncActors) {
  return t.procedure
    .input(sessionEnsureInputSchema)
    .output(sessionEnsureOutputSchema)
    .mutation(async ({ input }) => {
      const current = findSessionByVendorIdentity(database, input.harness, input.nativeId)
      if (current !== null) return { argoId: current.argoId }
      const actor = sync[input.harness]
      const generation = actor.getSnapshot().context.generation
      const refreshedAt = actor.getSnapshot().context.refreshedAt
      actor.send({ type: 'Priority sync', nativeId: input.nativeId })
      await waitFor(
        actor,
        (snapshot) =>
          snapshot.context.generation > generation &&
          (findSessionByVendorIdentity(database, input.harness, input.nativeId) !== null ||
            (snapshot.context.priorityNativeId === null &&
              (snapshot.context.failure !== null || snapshot.context.refreshedAt !== refreshedAt))),
        { timeout: 30_000 },
      )
      const saved = findSessionByVendorIdentity(database, input.harness, input.nativeId)
      if (saved === null) throw new Error('Harness could not find or save this Session.')
      return { argoId: saved.argoId }
    })
}

function feedResponse({
  sessionId,
  harness,
  entries,
  availability,
  live,
}: {
  sessionId: string
  harness: 'claude' | 'codex'
  entries: SessionHistoryEntry[]
  availability: SessionAvailability
  live: boolean
}) {
  return {
    version: 1 as const,
    type: 'session.feed.read' as const,
    requestId: sessionId,
    sessionId,
    chainId: sessionId,
    revision: JSON.stringify(entries.map(({ sourceId }) => sourceId)),
    rows: entries.map(({ sourceId, role, text }) => ({
      shape: 'prose' as const,
      id: sourceId,
      role: role === 'system' ? ('assistant' as const) : role,
      text,
    })),
    harness,
    availability,
    live,
  }
}

export function sessionFeedProcedure(
  database: DurableDatabase,
  codex: ActorRefFrom<typeof codexAppServerMachine>,
  supervisor: SessionSupervisorActor,
) {
  return t.procedure
    .input(sessionFeedInputSchema)
    .output(sessionFeedOutputSchema)
    .query(async ({ input }) => {
      const identity = readSessionIdentity(database, input.sessionId)
      if (identity === null) throw new Error('Session is not indexed.')
      const live = supervisor.getSnapshot().context.sessions[input.sessionId]
      switch (identity.harness) {
        case 'claude': {
          const entries = await readClaudeHistory(identity.nativeId)
          return feedResponse({
            sessionId: input.sessionId,
            harness: identity.harness,
            entries,
            availability: { state: 'available', reason: null },
            live: live !== undefined,
          })
        }
        case 'codex': {
          const history = await readCodexHistory(requestCodexAppServer(codex), identity.nativeId)
          const availability =
            live === undefined
              ? history.availability
              : { state: 'available' as const, reason: null }
          return feedResponse({
            sessionId: input.sessionId,
            harness: identity.harness,
            entries: history.entries,
            availability,
            live: live !== undefined,
          })
        }
        default:
          throw new Error(`Session Harness is not supported: ${identity.harness}`)
      }
    })
}

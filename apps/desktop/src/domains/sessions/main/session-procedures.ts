import { initTRPC } from '@trpc/server'
import type { ActorRefFrom } from 'xstate'
import { readClaudeHistory } from '@/harnesses/claude/session/claude-history'
import {
  type codexAppServerMachine,
  requestCodexAppServer,
} from '@/harnesses/codex/app-server/codex-app-server-machine'
import { readCodexHistory } from '@/harnesses/codex/session/codex-history'
import type { DurableDatabase } from '@/platform/main/storage/durable-database'
import { sessionFeedInputSchema, sessionFeedOutputSchema } from '../contract/session-history'
import { sessionPageInputSchema, sessionPageOutputSchema } from '../contract/session-index'
import { sessionAcceptedOutputSchema, sessionSubmitInputSchema } from '../contract/session-start'
import type { SessionSupervisorActor } from './live/session-supervisor-machine'
import { readSessionIdentity, readSessionPage } from './storage/session-records'

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
            if (input.pendingId === null)
              throw new Error('A new Session requires its pending identity.')
            supervisor.send({ type: 'Start', input, pendingId: input.pendingId, reply })
          } else
            supervisor.send({
              type: 'Send',
              input: { ...input, sessionId: input.sessionId },
              reply,
            })
        }),
    )
}

export function sessionPageProcedure(database: DurableDatabase) {
  return t.procedure
    .input(sessionPageInputSchema)
    .output(sessionPageOutputSchema)
    .query(({ input }) => sessionPageOutputSchema.parse(readSessionPage(database, input)))
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
          return entries.length === 0
            ? {
                result: 'empty' as const,
                harness: identity.harness,
                availability: { state: 'available' as const, reason: null },
                live: live !== undefined,
              }
            : {
                result: 'history' as const,
                harness: identity.harness,
                availability: { state: 'available' as const, reason: null },
                entries,
                live: live !== undefined,
              }
        }
        case 'codex': {
          const history = await readCodexHistory(requestCodexAppServer(codex), identity.nativeId)
          const availability =
            live === undefined
              ? history.availability
              : { state: 'available' as const, reason: null }
          return history.entries.length === 0
            ? {
                result: 'empty' as const,
                harness: identity.harness,
                availability,
                live: live !== undefined,
              }
            : {
                result: 'history' as const,
                harness: identity.harness,
                availability,
                entries: history.entries,
                live: live !== undefined,
              }
        }
        default:
          throw new Error(`Session Harness is not supported: ${identity.harness}`)
      }
    })
}

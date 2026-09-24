import { initTRPC } from '@trpc/server'
import type { ActorRefFrom } from 'xstate'
import { z } from 'zod'
import type { sessionSyncMachine } from './session-sync-machine'

export type SessionSyncActors = Record<'claude' | 'codex', ActorRefFrom<typeof sessionSyncMachine>>

const sourceSchema = z.strictObject({
  state: z.enum(['syncing', 'waiting', 'retrying']),
  indexedCount: z.number().int().nonnegative(),
  invalidRecordCount: z.number().int().nonnegative(),
  refreshedAt: z.number().int().nullable(),
  failure: z.string().nullable(),
})

const outputSchema = z.strictObject({
  claude: sourceSchema,
  codex: sourceSchema,
})

function source(actor: ActorRefFrom<typeof sessionSyncMachine>) {
  const snapshot = actor.getSnapshot()
  const { indexedCount, invalidRecordCount, refreshedAt, failure } = snapshot.context
  let state: 'syncing' | 'retrying' | 'waiting' = 'waiting'
  if (snapshot.matches('Syncing')) state = 'syncing'
  else if (snapshot.matches('Retrying')) state = 'retrying'
  return { state, indexedCount, invalidRecordCount, refreshedAt, failure }
}

const t = initTRPC.create()

export function sessionSyncStatusProcedure(actors: SessionSyncActors) {
  return t.procedure.output(outputSchema).query(() => ({
    claude: source(actors.claude),
    codex: source(actors.codex),
  }))
}

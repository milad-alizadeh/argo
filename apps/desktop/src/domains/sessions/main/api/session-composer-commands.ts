import { initTRPC } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import { z } from 'zod'
import type { Database } from '@/database/database'
import {
  type ComposerCommandListing,
  composerCommandListingSchema,
} from '@/domains/sessions/api/composer-commands'
import { type Harness, harnessSchema } from '@/harnesses/harness'
import {
  type LiveSessionSupervisorActor,
  liveSessionActorFor,
} from '../live/live-session-supervisor-machine'
import { sessionHistoryIdentity } from './session-history-identity'

const t = initTRPC.create()
const PENDING: ComposerCommandListing = { availability: 'pending', commands: [] }

export type ComposerCommandContext = {
  database: Database
  supervisor: LiveSessionSupervisorActor
  listComposerCommands?: (input: {
    harness: Harness
    cwd: string | null
  }) => Promise<ComposerCommandListing>
}

// A Harness that can read commands does. One that only lists once a Session is live stays pending.
// One with neither source is unavailable, including a Harness this build does not know.
export async function listComposerCommandsFor(
  registration: {
    listCommands?: (input: { cwd: string | null }) => Promise<ComposerCommandListing>
    openLiveSession?: unknown
  },
  cwd: string | null,
): Promise<ComposerCommandListing> {
  if (registration.listCommands) return registration.listCommands({ cwd })
  if (registration.openLiveSession) return PENDING
  return { availability: 'unavailable', commands: [] }
}

export function composerCommandsProcedure(context: ComposerCommandContext) {
  return t.procedure
    .input(z.strictObject({ harness: harnessSchema, cwd: z.string().nullable() }))
    .output(composerCommandListingSchema)
    .query(({ input }) => context.listComposerCommands?.(input) ?? Promise.resolve(PENDING))
}

export function sessionComposerCommandsProcedure(context: ComposerCommandContext) {
  return t.procedure
    .input(z.strictObject({ sessionId: z.string().min(1) }))
    .subscription(({ input }) =>
      observable<ComposerCommandListing>((emit) => {
        const actor = liveSessionActorFor(context.supervisor, input.sessionId)
        if (actor !== undefined) {
          const send = () => {
            emit.next(actor.getSnapshot().context.commands ?? PENDING)
          }
          send()
          const subscription = actor.subscribe(send)
          return () => subscription.unsubscribe()
        }
        let closed = false
        void (async () => {
          try {
            const stored = sessionHistoryIdentity(context.database, input.sessionId)
            const listing = await context.listComposerCommands?.({
              harness: stored.harness,
              cwd: stored.cwd,
            })
            if (!closed) emit.next(listing ?? PENDING)
          } catch {
            if (!closed) emit.next(PENDING)
          }
        })()
        return () => {
          closed = true
        }
      }),
    )
}

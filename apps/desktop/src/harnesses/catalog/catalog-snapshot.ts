import { initTRPC } from '@trpc/server'
import type { ActorRefFrom } from 'xstate'
import { z } from 'zod'
import { type createHarnessCatalogMachine, harnessInfoSchema } from './harness-catalog-machine'

const t = initTRPC.create()
const inputSchema = z.strictObject({ harness: z.enum(['claude', 'codex']) })
const outputSchema = z.strictObject({
  info: harnessInfoSchema,
  failure: z.string().nullable(),
})

export type CatalogActor = ActorRefFrom<ReturnType<typeof createHarnessCatalogMachine>>
type Harness = z.infer<typeof inputSchema>['harness']

function selectedSnapshot(actor: CatalogActor, harness: Harness) {
  const snapshot = actor.getSnapshot()
  const info = snapshot.context.catalog.harnesses.find((entry) => entry.harness === harness)
  if (info === undefined) throw new Error(`The ${harness} Harness is missing from the catalog.`)
  return { info, failure: snapshot.context.failure }
}

export function readCatalogSnapshot(actor: CatalogActor, harness: Harness) {
  actor.send({ type: 'Catalog requested' })
  const current = actor.getSnapshot()
  if (current.matches('Ready') || current.matches('Failed'))
    return Promise.resolve(selectedSnapshot(actor, harness))
  return new Promise<ReturnType<typeof selectedSnapshot>>((resolve) => {
    const subscription = actor.subscribe((snapshot) => {
      if (!snapshot.matches('Ready') && !snapshot.matches('Failed')) return
      subscription.unsubscribe()
      resolve(selectedSnapshot(actor, harness))
    })
    const latest = actor.getSnapshot()
    if (latest.matches('Ready') || latest.matches('Failed')) {
      subscription.unsubscribe()
      resolve(selectedSnapshot(actor, harness))
    }
  })
}

export function catalogSnapshotProcedure(actor: CatalogActor) {
  return t.procedure
    .input(inputSchema)
    .output(outputSchema)
    .query(({ input }) => readCatalogSnapshot(actor, input.harness))
}

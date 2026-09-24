import { initTRPC } from '@trpc/server'
import { catalogSnapshotProcedure } from '@/harnesses/catalog/catalog-snapshot'
import { harnessCatalogActor } from '@/harnesses/catalog/runtime'

const t = initTRPC.create()

export function createAppRouter(actor: typeof harnessCatalogActor) {
  return t.router({ harnessCatalogSnapshot: catalogSnapshotProcedure(actor) })
}

export const appRouter = createAppRouter(harnessCatalogActor)
export type AppRouter = typeof appRouter

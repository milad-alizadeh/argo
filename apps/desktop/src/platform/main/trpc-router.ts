import { initTRPC } from '@trpc/server'
import { type CatalogActor, catalogSnapshotProcedure } from '@/harnesses/catalog/catalog-snapshot'

const t = initTRPC.create()

export function createAppRouter(actor: CatalogActor) {
  return t.router({ harnessCatalogSnapshot: catalogSnapshotProcedure(actor) })
}

export type AppRouter = ReturnType<typeof createAppRouter>

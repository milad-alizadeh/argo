import { initTRPC } from '@trpc/server'
import {
  type CatalogActor,
  catalogRefreshProcedure,
  catalogSnapshotProcedure,
} from '@/harnesses/catalog/catalog-snapshot'

const t = initTRPC.create()

export function createAppRouter(actor: CatalogActor) {
  return t.router({
    harnessCatalogSnapshot: catalogSnapshotProcedure(actor),
    harnessCatalogRefresh: catalogRefreshProcedure(actor),
  })
}

export type AppRouter = ReturnType<typeof createAppRouter>

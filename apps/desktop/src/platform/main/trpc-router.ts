import { initTRPC } from '@trpc/server'
import {
  type CatalogActor,
  catalogReadProcedure,
  catalogRefreshProcedure,
} from '@/harnesses/catalog/catalog-read'

const t = initTRPC.create()

export function createAppRouter(actor: CatalogActor) {
  return t.router({
    harnessCatalogRead: catalogReadProcedure(actor),
    harnessCatalogRefresh: catalogRefreshProcedure(actor),
  })
}

export type AppRouter = ReturnType<typeof createAppRouter>

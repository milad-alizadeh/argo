import { initTRPC } from '@trpc/server'
import {
  type CatalogActor,
  catalogReadProcedure,
  catalogRefreshProcedure,
} from '@/harnesses/catalog/catalog-read'
import { sessionSubmitProcedure } from '@/domains/sessions/main/session-procedures'
import type { SessionRuntime } from '@/domains/sessions/main/live/session-runtime'

const t = initTRPC.create()

export function createAppRouter(actor: CatalogActor, sessions: SessionRuntime) {
  return t.router({
    harnessCatalogRead: catalogReadProcedure(actor),
    harnessCatalogRefresh: catalogRefreshProcedure(actor),
    sessionSubmit: sessionSubmitProcedure(sessions),
  })
}

export type AppRouter = ReturnType<typeof createAppRouter>

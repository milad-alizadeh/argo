import { initTRPC } from '@trpc/server'
import { sessionSubmitProcedure } from '@/domains/sessions/main/api/session-procedures'
import type { SessionSupervisorActor } from '@/domains/sessions/main/live/session-supervisor-machine'
import {
  type CatalogActor,
  catalogReadProcedure,
  catalogRefreshProcedure,
} from '@/harnesses/catalog/catalog-read'

const t = initTRPC.create()

export function createAppRouter(actor: CatalogActor, sessions: SessionSupervisorActor) {
  return t.router({
    harnessCatalogRead: catalogReadProcedure(actor),
    harnessCatalogRefresh: catalogRefreshProcedure(actor),
    sessionSubmit: sessionSubmitProcedure(sessions),
  })
}

export type AppRouter = ReturnType<typeof createAppRouter>

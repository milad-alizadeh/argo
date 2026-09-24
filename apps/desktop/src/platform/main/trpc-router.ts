import { initTRPC } from '@trpc/server'
import type { SessionSupervisorActor } from '@/domains/sessions/main/live/session-supervisor-machine'
import { sessionSubmitProcedure } from '@/domains/sessions/main/session-procedures'
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

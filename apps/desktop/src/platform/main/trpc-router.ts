import { initTRPC } from '@trpc/server'
import { projectProcedures } from '@/domains/projects/main/api/project-procedures'
import type { ProjectStore } from '@/domains/projects/main/register-project'
import { sessionSubmitProcedure } from '@/domains/sessions/main/api/session-procedures'
import type { LiveSessionSupervisorActor } from '@/domains/sessions/main/live/live-session-supervisor-machine'
import {
  type CatalogActor,
  catalogReadProcedure,
  catalogRefreshProcedure,
} from '@/harnesses/catalog/catalog-read'

const t = initTRPC.create()

export function createAppRouter(
  actor: CatalogActor,
  sessions: LiveSessionSupervisorActor,
  projects?: ProjectStore,
) {
  return t.router({
    harnessCatalogRead: catalogReadProcedure(actor),
    harnessCatalogRefresh: catalogRefreshProcedure(actor),
    sessionSubmit: sessionSubmitProcedure(sessions),
    ...projectProcedures(projects ?? null),
  })
}

export type AppRouter = ReturnType<typeof createAppRouter>

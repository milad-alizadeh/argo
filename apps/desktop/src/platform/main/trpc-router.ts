import { initTRPC } from '@trpc/server'
import { projectListProcedure } from '@/domains/projects/main/api/project-list'
import { projectOpenProcedure } from '@/domains/projects/main/api/project-open'
import { projectRegisterProcedure } from '@/domains/projects/main/api/project-register'
import { projectRelocateProcedure } from '@/domains/projects/main/api/project-relocate'
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
  projects: ProjectStore,
) {
  return t.router({
    harnessCatalogRead: catalogReadProcedure(actor),
    harnessCatalogRefresh: catalogRefreshProcedure(actor),
    sessionSubmit: sessionSubmitProcedure(sessions),
    projectList: projectListProcedure(projects),
    projectOpen: projectOpenProcedure(projects),
    projectRegister: projectRegisterProcedure(projects),
    projectRelocate: projectRelocateProcedure(projects),
  })
}

export type AppRouter = ReturnType<typeof createAppRouter>

import { initTRPC } from '@trpc/server'
import {
  type AccountProcedureContext,
  accountProcedures,
} from '@/domains/accounts/main/account-procedures'
import {
  type HarnessSignInProcedureContext,
  harnessSignInProcedures,
} from '@/domains/harness-signin/main/harness-sign-in-procedures'
import { projectListProcedure } from '@/domains/projects/main/api/project-list'
import { projectOpenProcedure } from '@/domains/projects/main/api/project-open'
import { projectRegisterProcedure } from '@/domains/projects/main/api/project-register'
import { projectRelocateProcedure } from '@/domains/projects/main/api/project-relocate'
import {
  type ProjectProcedureContext,
  projectProcedures,
} from '@/domains/projects/main/project-procedures'
import { sessionSubmitProcedure } from '@/domains/sessions/main/api/session-procedures'
import type { LiveSessionSupervisorActor } from '@/domains/sessions/main/live/live-session-supervisor-machine'
import {
  createTicketRouter,
  type TicketRouterDependencies,
} from '@/domains/tickets/main/ticket-router'
import {
  type CatalogActor,
  catalogReadProcedure,
  catalogRefreshProcedure,
} from '@/harnesses/catalog/catalog-read'

const t = initTRPC.create()

export type AppRouterDependencies = {
  accounts: AccountProcedureContext
  catalog: CatalogActor
  harnessSignIn: HarnessSignInProcedureContext
  projects: ProjectProcedureContext
  sessions: LiveSessionSupervisorActor
  tickets: TicketRouterDependencies
}

export function createAppRouter(dependencies: AppRouterDependencies) {
  return t.router({
    ...accountProcedures(dependencies.accounts),
    ...harnessSignInProcedures(dependencies.harnessSignIn),
    ...projectProcedures(dependencies.projects),
    harnessCatalogRead: catalogReadProcedure(dependencies.catalog),
    harnessCatalogRefresh: catalogRefreshProcedure(dependencies.catalog),
    sessionSubmit: sessionSubmitProcedure(dependencies.sessions),
    projectList: projectListProcedure(dependencies.projects),
    projectOpen: projectOpenProcedure(dependencies.projects),
    projectRegister: projectRegisterProcedure(dependencies.projects),
    projectRelocate: projectRelocateProcedure(dependencies.projects),
    tickets: createTicketRouter(dependencies.tickets),
  })
}

export type AppRouter = ReturnType<typeof createAppRouter>

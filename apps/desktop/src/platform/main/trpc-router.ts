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
import {
  type ProjectRegisterContext,
  projectRegisterProcedure,
} from '@/domains/projects/main/api/project-register'
import {
  type ProjectRelocateContext,
  projectRelocateProcedure,
} from '@/domains/projects/main/api/project-relocate'
import { sessionSubmitProcedure } from '@/domains/sessions/main/api/session-procedures'
import type { LiveSessionSupervisorActor } from '@/domains/sessions/main/live/live-session-supervisor-machine'
import {
  createTicketRouter,
  type TicketRouterDependencies,
} from '@/domains/tickets/main/ticket-router'
import {
  type WorkspaceListContext,
  workspaceListProcedure,
} from '@/domains/workspaces/main/api/workspace-list'
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
  projects: ProjectRegisterContext & ProjectRelocateContext
  sessions: LiveSessionSupervisorActor
  tickets: TicketRouterDependencies
  workspaces: WorkspaceListContext
}

export function createAppRouter(dependencies: AppRouterDependencies) {
  return t.router({
    ...accountProcedures(dependencies.accounts),
    ...harnessSignInProcedures(dependencies.harnessSignIn),
    harnessCatalogRead: catalogReadProcedure(dependencies.catalog),
    harnessCatalogRefresh: catalogRefreshProcedure(dependencies.catalog),
    sessionSubmit: sessionSubmitProcedure(dependencies.sessions),
    projectList: projectListProcedure(dependencies.projects.database),
    projectOpen: projectOpenProcedure(dependencies.projects.database),
    projectRegister: projectRegisterProcedure(dependencies.projects),
    projectRelocate: projectRelocateProcedure(dependencies.projects),
    workspaceList: workspaceListProcedure(dependencies.workspaces),
    tickets: createTicketRouter(dependencies.tickets),
  })
}

export type AppRouter = ReturnType<typeof createAppRouter>

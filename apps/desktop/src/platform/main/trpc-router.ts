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
import { composerDraftCreateProcedure } from '@/domains/sessions/main/api/composer-draft-create'
import { composerDraftReadProcedure } from '@/domains/sessions/main/api/composer-draft-read'
import { composerDraftSaveProcedure } from '@/domains/sessions/main/api/composer-draft-save'
import { sessionListProcedure } from '@/domains/sessions/main/api/session-list'
import {
  type SessionRefreshContext,
  sessionRefreshProcedure,
} from '@/domains/sessions/main/api/session-refresh'
import { sessionRenameProcedure } from '@/domains/sessions/main/api/session-rename'
import {
  type SessionProcedureContext,
  sessionSubmitProcedure,
} from '@/domains/sessions/main/api/session-submit'
import {
  type SessionSyncStatusStore,
  sessionSyncStatusProcedure,
} from '@/domains/sessions/main/api/session-sync-status'
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
  sessions: SessionProcedureContext &
    SessionRefreshContext & { sessionSyncStatus: SessionSyncStatusStore }
  tickets: TicketRouterDependencies
  workspaces: WorkspaceListContext
}

export function createAppRouter(dependencies: AppRouterDependencies) {
  return t.router({
    ...accountProcedures(dependencies.accounts),
    ...harnessSignInProcedures(dependencies.harnessSignIn),
    harnessCatalogRead: catalogReadProcedure(dependencies.catalog),
    harnessCatalogRefresh: catalogRefreshProcedure(dependencies.catalog),
    composerDraftCreate: composerDraftCreateProcedure(dependencies.sessions.database),
    composerDraftRead: composerDraftReadProcedure(dependencies.sessions.database),
    composerDraftSave: composerDraftSaveProcedure(dependencies.sessions.database),
    sessionSubmit: sessionSubmitProcedure(dependencies.sessions),
    sessions: t.router({
      list: sessionListProcedure(dependencies.sessions),
      rename: sessionRenameProcedure(dependencies.sessions),
      refresh: sessionRefreshProcedure(dependencies.sessions),
      syncStatus: sessionSyncStatusProcedure(dependencies.sessions.sessionSyncStatus),
    }),
    projectList: projectListProcedure(dependencies.projects.database),
    projectOpen: projectOpenProcedure(dependencies.projects.database),
    projectRegister: projectRegisterProcedure(dependencies.projects),
    projectRelocate: projectRelocateProcedure(dependencies.projects),
    workspaceList: workspaceListProcedure(dependencies.workspaces),
    tickets: createTicketRouter(dependencies.tickets),
  })
}

export type AppRouter = ReturnType<typeof createAppRouter>

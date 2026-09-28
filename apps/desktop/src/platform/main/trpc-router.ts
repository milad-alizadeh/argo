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
import {
  type SessionFeedReadContext,
  sessionFeedReadProcedure,
} from '@/domains/sessions/main/api/session-feed-read'
import {
  type SessionInteractionContext,
  sessionInteractionProcedures,
} from '@/domains/sessions/main/api/session-interactions'
import {
  type SessionListContext,
  sessionListProcedure,
} from '@/domains/sessions/main/api/session-list'
import {
  type SessionLiveEventsContext,
  sessionLiveEventsProcedure,
} from '@/domains/sessions/main/api/session-live-events'
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
  type AutoCompactLimitLookup,
  autoCompactLimitReadProcedure,
  autoCompactLimitWriteProcedure,
} from './harness-catalog/auto-compact-limit'
import {
  type CatalogActor,
  catalogReadProcedure,
  catalogRefreshProcedure,
} from './harness-catalog/catalog-read'

const t = initTRPC.create()

export type AppRouterDependencies = {
  accounts: AccountProcedureContext
  autoCompactLimit: AutoCompactLimitLookup
  catalog: CatalogActor
  harnessSignIn: HarnessSignInProcedureContext
  projects: ProjectRegisterContext & ProjectRelocateContext
  sessions: SessionProcedureContext &
    SessionFeedReadContext &
    SessionInteractionContext &
    SessionListContext &
    SessionLiveEventsContext &
    SessionRefreshContext & { sessionSyncStatus: readonly SessionSyncStatusStore[] }
  tickets: TicketRouterDependencies
  workspaces: WorkspaceListContext
}

export function createAppRouter(dependencies: AppRouterDependencies) {
  return t.router({
    ...accountProcedures(dependencies.accounts),
    ...harnessSignInProcedures(dependencies.harnessSignIn),
    harnessCatalogRead: catalogReadProcedure(dependencies.catalog),
    harnessCatalogRefresh: catalogRefreshProcedure(dependencies.catalog),
    harnessAutoCompactLimitRead: autoCompactLimitReadProcedure(dependencies.autoCompactLimit),
    harnessAutoCompactLimitWrite: autoCompactLimitWriteProcedure(dependencies.autoCompactLimit),
    composerDraftCreate: composerDraftCreateProcedure(dependencies.sessions.database),
    composerDraftRead: composerDraftReadProcedure(dependencies.sessions.database),
    composerDraftSave: composerDraftSaveProcedure(dependencies.sessions.database),
    sessionSubmit: sessionSubmitProcedure(dependencies.sessions),
    sessionList: sessionListProcedure(dependencies.sessions),
    sessionFeedRead: sessionFeedReadProcedure(dependencies.sessions),
    ...sessionInteractionProcedures(dependencies.sessions),
    sessionLiveEvents: sessionLiveEventsProcedure(dependencies.sessions),
    sessionRename: sessionRenameProcedure(dependencies.sessions),
    sessionRefresh: sessionRefreshProcedure(dependencies.sessions),
    sessionSyncStatus: sessionSyncStatusProcedure(dependencies.sessions.sessionSyncStatus),
    projectList: projectListProcedure(dependencies.projects.database),
    projectOpen: projectOpenProcedure(dependencies.projects.database),
    projectRegister: projectRegisterProcedure(dependencies.projects),
    projectRelocate: projectRelocateProcedure(dependencies.projects),
    workspaceList: workspaceListProcedure(dependencies.workspaces),
    tickets: createTicketRouter(dependencies.tickets),
  })
}

export type AppRouter = ReturnType<typeof createAppRouter>

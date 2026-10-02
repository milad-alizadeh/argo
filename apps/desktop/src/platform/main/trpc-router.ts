import { initTRPC } from '@trpc/server'
import {
  type AccountProcedureContext,
  accountProcedures,
} from '@/domains/accounts/main/account-procedures'
import {
  type HarnessSignInProcedureContext,
  harnessSignInProcedures,
} from '@/domains/harness-signin/main/harness-sign-in-procedures'
import { type ProjectApiContext, projectProcedures } from '@/domains/projects/main/api'
import { type SessionApiContext, sessionProcedures } from '@/domains/sessions/main/api'
import { type TicketProcedureContext, ticketProcedures } from '@/domains/tickets/main/api'
import {
  type HarnessCatalogApiContext,
  harnessCatalogProcedures,
} from './harness-catalog/harness-catalog-procedures'

const t = initTRPC.create()

export type AppRouterDependencies = HarnessCatalogApiContext & {
  accounts: AccountProcedureContext
  harnessSignIn: HarnessSignInProcedureContext
  projects: ProjectApiContext
  sessions: SessionApiContext
  tickets: TicketProcedureContext
}

export function createAppRouter(dependencies: AppRouterDependencies) {
  return t.router({
    ...accountProcedures(dependencies.accounts),
    ...harnessSignInProcedures(dependencies.harnessSignIn),
    ...harnessCatalogProcedures(dependencies),
    ...sessionProcedures(dependencies.sessions),
    ...projectProcedures(dependencies.projects),
    ...ticketProcedures(dependencies.tickets),
  })
}

export type AppRouter = ReturnType<typeof createAppRouter>

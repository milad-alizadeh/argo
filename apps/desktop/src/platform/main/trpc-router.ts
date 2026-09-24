import { initTRPC } from '@trpc/server'
import type { ActorRefFrom } from 'xstate'
import type { SessionSupervisorActor } from '@/domains/sessions/main/live/session-supervisor-machine'
import {
  sessionFeedProcedure,
  sessionListProcedure,
  sessionSubmitProcedure,
} from '@/domains/sessions/main/session-procedures'
import {
  type CatalogActor,
  catalogReadProcedure,
  catalogRefreshProcedure,
} from '@/harnesses/catalog/catalog-read'
import type { codexAppServerMachine } from '@/harnesses/codex/app-server/codex-app-server-machine'
import type { DurableDatabase } from '@/platform/main/storage/durable-database'

const t = initTRPC.create()

export function createAppRouter({
  actor,
  sessions,
  database,
  codex,
}: {
  actor: CatalogActor
  sessions: SessionSupervisorActor
  database: DurableDatabase
  codex: ActorRefFrom<typeof codexAppServerMachine>
}) {
  return t.router({
    harnessCatalogRead: catalogReadProcedure(actor),
    harnessCatalogRefresh: catalogRefreshProcedure(actor),
    sessionSubmit: sessionSubmitProcedure(sessions),
    sessions: t.router({ list: sessionListProcedure(database) }),
    sessionFeed: sessionFeedProcedure(database, codex, sessions),
  })
}

export type AppRouter = ReturnType<typeof createAppRouter>

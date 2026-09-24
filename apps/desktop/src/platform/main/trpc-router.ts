import { initTRPC } from '@trpc/server'
import type { ActorRefFrom } from 'xstate'
import type { SessionSupervisorActor } from '@/domains/sessions/main/live/session-supervisor-machine'
import {
  sessionEnsureProcedure,
  sessionFeedProcedure,
  sessionGetProcedure,
  sessionListProcedure,
  sessionRenameProcedure,
  sessionSetArchivedProcedure,
  sessionSubmitProcedure,
} from '@/domains/sessions/main/session-procedures'
import {
  type SessionSyncActors,
  sessionSyncStatusProcedure,
} from '@/domains/sessions/main/sync/session-sync-status'
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
  sync,
}: {
  actor: CatalogActor
  sessions: SessionSupervisorActor
  database: DurableDatabase
  codex: ActorRefFrom<typeof codexAppServerMachine>
  sync: SessionSyncActors
}) {
  return t.router({
    harnessCatalogRead: catalogReadProcedure(actor),
    harnessCatalogRefresh: catalogRefreshProcedure(actor),
    sessionSubmit: sessionSubmitProcedure(sessions),
    sessionSyncStatus: sessionSyncStatusProcedure(sync),
    sessions: {
      ensure: sessionEnsureProcedure(database, sync),
      get: sessionGetProcedure(database),
      list: sessionListProcedure(database),
      rename: sessionRenameProcedure(database),
      setArchived: sessionSetArchivedProcedure(database),
    },
    sessionFeed: sessionFeedProcedure(database, codex, sessions),
  })
}

export type AppRouter = ReturnType<typeof createAppRouter>

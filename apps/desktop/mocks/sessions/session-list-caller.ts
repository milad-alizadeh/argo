import { type inferRouterOutputs, initTRPC } from '@trpc/server'
import type { z } from 'zod'
import type { Database } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import { sessionArchive } from '@/database/session-archive/schema'
import { sessionDetailsProcedure } from '@/domains/sessions/main/api/session-details'
import {
  sessionListChangedProcedure,
  sessionListProcedure,
  type sessionListRowSchema,
} from '@/domains/sessions/main/api/session-list'
import { SessionRosterChanges } from '@/domains/sessions/main/api/session-roster-changes'
import {
  type SessionUpdateProcedureContext,
  sessionUpdateProcedure,
} from '@/domains/sessions/main/api/session-update-procedure'
import {
  insertProject,
  insertWorkspace,
  migratedDatabase,
} from '@/mocks/database/migrated-database'
import type { AppRouter } from '@/platform/main/trpc-router'

export const IDS = [
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
] as const

export type SessionListRow = z.infer<typeof sessionListRowSchema>
type SessionListChange = inferRouterOutputs<AppRouter>['sessionListChanged']
type RenameRequest = Parameters<SessionUpdateProcedureContext['rename']>[0]

function mockSupervisor(sessions: Record<string, unknown>) {
  const statusListeners = new Set<(event: { sessionId: string }) => void>()
  const supervisor = {
    on: (_type: string, listener: (event: { sessionId: string }) => void) => {
      statusListeners.add(listener)
      return { unsubscribe: () => statusListeners.delete(listener) }
    },
    system: { get: (id: string) => sessions[id] },
    getSnapshot: () => ({
      context: {
        sessions: Object.fromEntries(Object.keys(sessions).map((id) => [id, id])),
        starts: {},
      },
    }),
  }
  const statusChanged = (sessionId: string) => {
    for (const listener of statusListeners) listener({ sessionId })
  }
  return { supervisor, statusChanged }
}

export function sessionListCaller(
  sessions: Record<string, unknown> = {},
  observeFeed: (sessionId: string) => () => void = () => () => {},
) {
  const database = migratedDatabase()
  const client = database.$client
  const { supervisor, statusChanged } = mockSupervisor(sessions)
  const roster = new SessionRosterChanges()
  const renames: RenameRequest[] = []
  const context = {
    database,
    supervisor: supervisor as never,
    roster,
    rename: async (request: RenameRequest) => {
      renames.push(request)
    },
  }
  const caller = initTRPC
    .create()
    .router({
      list: sessionListProcedure(context),
      changed: sessionListChangedProcedure(context, observeFeed),
      update: sessionUpdateProcedure(context),
      details: sessionDetailsProcedure(context),
    })
    .createCaller({})
  const changes = async () => {
    const received: SessionListChange[] = []
    const stream = await caller.changed()
    const subscription = stream.subscribe({ next: (change) => received.push(change) })
    return { received, stop: () => subscription.unsubscribe() }
  }
  return {
    client,
    database,
    list: caller.list,
    update: caller.update,
    details: caller.details,
    changes,
    roster,
    statusChanged,
    renames,
  }
}

export const settled = () => new Promise((resolve) => setTimeout(resolve, 0))

export function liveSession(state: string, status: string | null = null) {
  return {
    getSnapshot: () => ({
      value: state,
      matches: (candidate: string) => candidate === state,
      context: {
        status,
        turnConfiguration: { model: 'claude-sonnet', effort: 'high', mode: 'default' },
      },
    }),
  }
}

// Saves one Session, and its Project and Workspace, with the stored columns a test names.
export function insertSession(
  database: Database,
  {
    id,
    archived,
    ...values
  }: Partial<typeof sessionTable.$inferInsert> & { id: string; archived?: boolean },
) {
  const projectId = values.projectId ?? 'project-1'
  insertProject(database, projectId)
  if (values.workspaceId != null) insertWorkspace(database, values.workspaceId, projectId)
  database
    .insert(sessionTable)
    .values({
      harness: 'claude',
      nativeId: id,
      updatedAt: values.createdAt,
      ...values,
      argoId: id,
      projectId,
    })
    .run()
  if (archived === true) database.insert(sessionArchive).values({ sessionId: id }).run()
}

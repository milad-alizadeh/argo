import type { DatabaseSync } from 'node:sqlite'
import { initTRPC } from '@trpc/server'
import type { z } from 'zod'
import { databaseFrom } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import { sessionArchive } from '@/database/session-archive/schema'
import { SessionActivities } from '@/domains/sessions/main/api/session-activities'
import {
  sessionListChangedProcedure,
  sessionListProcedure,
  type sessionListRowSchema,
} from '@/domains/sessions/main/api/session-list'
import { SessionRosterChanges } from '@/domains/sessions/main/api/session-roster-changes'
import { sessionUpdateProcedure } from '@/domains/sessions/main/api/session-update-procedure'
import type { Harness } from '@/harnesses/harness'
import {
  insertProject,
  insertWorkspace,
  migratedDatabase,
} from '@/mocks/database/migrated-database'

export const IDS = [
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
] as const

export type SessionListRow = z.infer<typeof sessionListRowSchema>
export type SessionListChange = { sessionIds: string[] }
type RenameRequest = { harness: Harness; nativeId: string; title: string }

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
  const activities = new SessionActivities({ database, roster })
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
    list: caller.list,
    update: caller.update,
    changes,
    roster,
    statusChanged,
    activities,
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

type SessionTableStatus = typeof sessionTable.$inferInsert.status

export function insertSession(
  client: DatabaseSync,
  values: {
    id: string
    harness: string
    nativeId: string
    createdAt: number
    customTitle?: string | null
    preview?: string | null
    firstPrompt?: string | null
    cwd?: string | null
    workspaceId?: string | null
    activityAt?: number | null
    projectId?: string
    sortOrder?: number
    status?: SessionTableStatus
    archived?: boolean
  },
) {
  const database = databaseFrom(client)
  const projectId = values.projectId ?? 'project-1'
  insertProject(database, projectId)
  if (values.workspaceId != null) insertWorkspace(database, values.workspaceId, projectId)
  database
    .insert(sessionTable)
    .values({
      argoId: values.id,
      harness: values.harness,
      nativeId: values.nativeId,
      projectId,
      workspaceId: values.workspaceId ?? null,
      customTitle: values.customTitle ?? null,
      preview: values.preview ?? null,
      firstPrompt: values.firstPrompt ?? null,
      cwd: values.cwd ?? null,
      activityAt: values.activityAt ?? null,
      sortOrder: values.sortOrder ?? 0,
      status: values.status ?? null,
      createdAt: values.createdAt,
      updatedAt: values.createdAt,
    })
    .run()
  if (values.archived === true)
    database.insert(sessionArchive).values({ sessionId: values.id }).run()
}

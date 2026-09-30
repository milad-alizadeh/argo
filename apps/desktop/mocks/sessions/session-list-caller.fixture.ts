import { DatabaseSync } from 'node:sqlite'
import { initTRPC } from '@trpc/server'
import { migrate } from 'drizzle-orm/node-sqlite/migrator'
import { databaseFrom, databaseMigrationsFolder } from '@/database/database'
import { SessionActivities } from '@/domains/sessions/main/api/session-activities'
import {
  SessionListFeedObservers,
  sessionListProcedures,
} from '@/domains/sessions/main/api/session-list'
import { SessionRosterChanges } from '@/domains/sessions/main/api/session-roster-changes'
import { WatchedSessionStatus } from '@/domains/sessions/main/api/watched-session-status'

export const IDS = [
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
] as const
export const VIEW = '00000000-0000-4000-8000-0000000000aa'

export function sessionListCaller(
  sessions: Record<string, unknown> = {},
  observeFeed?: (sessionId: string) => () => void,
) {
  const client = new DatabaseSync(':memory:')
  const database = databaseFrom(client)
  migrate(database, { migrationsFolder: databaseMigrationsFolder() })
  client.exec(`INSERT INTO project (id, path, common_directory) VALUES
    ('project-1', '/work/one', '/work/one/.git'), ('project-2', '/work/two', '/work/two/.git');
  INSERT INTO workspace (id, project_id, kind, display_name, path)
    VALUES ('workspace-1', 'project-1', 'main', 'one', '/work/one');`)
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
  const roster = new SessionRosterChanges()
  const watchedStatus = new WatchedSessionStatus(() => roster.changed())
  const activities = new SessionActivities(() => roster.changed())
  const observers = new SessionListFeedObservers(observeFeed)
  const router = initTRPC
    .create()
    .router(
      sessionListProcedures(
        { database, supervisor: supervisor as never, roster, watchedStatus, activities },
        observers,
      ),
    )
  const caller = router.createCaller({})
  type WindowInput = Parameters<typeof caller.sessionListWindow>[0]
  const list = (
    input: Omit<WindowInput, 'view' | 'anchor'> & Partial<Pick<WindowInput, 'view' | 'anchor'>>,
  ) => caller.sessionListWindow({ view: VIEW, anchor: { kind: 'start' }, ...input })
  const changes = async (view = VIEW) => {
    const received: string[] = []
    const stream = await caller.sessionListChanges({ view })
    const subscription = stream.subscribe({ next: (change) => received.push(change.type) })
    return { received, stop: () => subscription.unsubscribe() }
  }
  const statusChanged = (sessionId: string) => {
    for (const listener of statusListeners) listener({ sessionId })
  }
  return {
    client,
    database,
    list,
    changes,
    roster,
    statusChanged,
    watchedStatus,
    activities,
    observers,
  }
}

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

export function insertSession(
  client: DatabaseSync,
  values: {
    id: string
    harness: string
    nativeId: string
    customTitle?: string | null
    preview?: string | null
    firstPrompt?: string | null
    cwd?: string | null
    workspaceId?: string | null
    activityAt?: number | null
    listOrderAt?: number
    projectId?: string
    updatedAt: number
  },
) {
  client
    .prepare(
      `INSERT INTO session (
        argo_id, harness, native_id, project_id, workspace_id, custom_title, preview,
        first_prompt, cwd, activity_at, list_order_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    )
    .run(
      values.id,
      values.harness,
      values.nativeId,
      values.projectId ?? 'project-1',
      values.workspaceId ?? null,
      values.customTitle ?? null,
      values.preview ?? null,
      values.firstPrompt ?? null,
      values.cwd ?? null,
      values.activityAt ?? null,
      values.listOrderAt ?? values.activityAt ?? values.updatedAt,
      values.updatedAt,
    )
}

export type Caller = ReturnType<typeof sessionListCaller>

export function listOneSession(client: DatabaseSync, list: Caller['list']) {
  insertSession(client, {
    id: IDS[0],
    harness: 'claude',
    nativeId: 'native-1',
    firstPrompt: 'First prompt',
    updatedAt: 10,
  })
  return list({ projectId: 'project-1', after: 10 })
}

export const settled = () => new Promise((resolve) => setTimeout(resolve, 0))

export function insertTicketLink(
  client: DatabaseSync,
  values: {
    sessionId: string
    projectId: string
    key: string
    title: string
    state: 'open' | 'closed'
  },
) {
  client
    .prepare(
      `INSERT INTO session_ticket_link (
        session_id, project_id, ticket_key, title, state, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      values.sessionId,
      values.projectId,
      values.key,
      values.title,
      values.state,
      '2026-09-26T10:00:00.000Z',
    )
}

export function orderedSessionIds(count: number) {
  return Array.from(
    { length: count },
    (_, index) => `00000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}`,
  )
}

export function insertOrderedSessions(client: DatabaseSync, count: number) {
  const ids = orderedSessionIds(count)
  // The first ID is the newest, so the list reads them in this order.
  for (const [index, id] of ids.entries())
    insertSession(client, {
      id,
      harness: 'claude',
      nativeId: `native-${index}`,
      firstPrompt: `Session ${index}`,
      updatedAt: 10_000 - index,
    })
  return ids
}

import { DatabaseSync } from 'node:sqlite'
import { initTRPC } from '@trpc/server'
import type { z } from 'zod'
import { databaseFrom } from '@/database/database'
import { SessionActivities } from '@/domains/sessions/main/api/session-activities'
import {
  sessionListChangedProcedure,
  sessionListProcedure,
  type sessionListRowSchema,
} from '@/domains/sessions/main/api/session-list'
import { SessionRosterChanges } from '@/domains/sessions/main/api/session-roster-changes'
import { sessionUpdateProcedure } from '@/domains/sessions/main/api/session-update-procedure'
import type { Harness } from '@/harnesses/harness'

// The Session List's tables, as the list procedures read them.
const SESSION_LIST_TABLES = `CREATE TABLE session (
    argo_id TEXT PRIMARY KEY,
    harness TEXT NOT NULL,
    native_id TEXT NOT NULL,
    project_id TEXT,
    workspace_id TEXT,
    custom_title TEXT,
    preview TEXT,
    first_prompt TEXT,
    cwd TEXT,
    activity_at INTEGER,
    sort_order INTEGER NOT NULL DEFAULT 0,
    activity TEXT,
    status TEXT,
    subagents_read_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  ); CREATE UNIQUE INDEX session_harness_native ON session (harness, native_id);
  CREATE TABLE session_ticket_link (
    session_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    ticket_key TEXT NOT NULL,
    title TEXT NOT NULL,
    state TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE session_subagent (
    session_id TEXT NOT NULL,
    subagent_id TEXT NOT NULL,
    label TEXT,
    state TEXT NOT NULL,
    PRIMARY KEY (session_id, subagent_id)
  );
  CREATE TABLE session_archive (session_id TEXT PRIMARY KEY);`

export const IDS = [
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
] as const

export type SessionListRow = z.infer<typeof sessionListRowSchema>
export type SessionListChange = { rows: SessionListRow[] }
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
  const client = new DatabaseSync(':memory:')
  client.exec(SESSION_LIST_TABLES)
  const database = databaseFrom(client)
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
    status?: string | null
    archived?: boolean
  },
) {
  client
    .prepare(
      `INSERT INTO session (
        argo_id, harness, native_id, project_id, workspace_id, custom_title, preview,
        first_prompt, cwd, activity_at, sort_order, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      values.sortOrder ?? 0,
      values.status ?? null,
      values.createdAt,
      values.createdAt,
    )
  if (values.archived === true)
    client.prepare('INSERT INTO session_archive (session_id) VALUES (?)').run(values.id)
}

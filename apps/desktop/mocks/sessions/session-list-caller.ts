import { DatabaseSync } from 'node:sqlite'
import { initTRPC } from '@trpc/server'
import type { z } from 'zod'
import { databaseFrom } from '@/database/database'
import { SessionActivities } from '@/domains/sessions/main/api/session-activities'
import {
  sessionListProcedure,
  type sessionListUpdateSchema,
} from '@/domains/sessions/main/api/session-list'
import { SessionRosterChanges } from '@/domains/sessions/main/api/session-roster-changes'
import { WatchedSessionStatus } from '@/domains/sessions/main/api/watched-session-status'

// The Session List's tables, as the list procedure reads them.
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
    list_order_at INTEGER NOT NULL DEFAULT 0,
    activity TEXT,
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

// Counts substring scans, the search's one cost that grows with every saved Session. A match
// test of one row by its Argo ID is not a scan.
function countSearchScans(client: DatabaseSync) {
  const searchScans = { count: 0 }
  const prepare = client.prepare.bind(client)
  client.prepare = (source: string) => {
    if (source.includes('instr(') && !source.includes('"argo_id" = ?')) searchScans.count += 1
    return prepare(source)
  }
  return searchScans
}

export const IDS = [
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
] as const

export function sessionListCaller(
  sessions: Record<string, unknown> = {},
  observeFeed?: (sessionId: string) => () => void,
) {
  const client = new DatabaseSync(':memory:')
  client.exec(SESSION_LIST_TABLES)
  const searchScans = countSearchScans(client)
  const database = databaseFrom(client)
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
  const watchedStatus = new WatchedSessionStatus(() => roster.changed('activity'))
  const activities = new SessionActivities(database, () => roster.changed('activity'))
  const router = initTRPC.create().router({
    list: sessionListProcedure(
      {
        database,
        supervisor: supervisor as never,
        roster,
        watchedStatus,
      },
      observeFeed,
    ),
  })
  const caller = router.createCaller({})
  const updates = async (input: Parameters<typeof caller.list>[0]) => {
    const received: SessionListUpdate[] = []
    const stream = await caller.list(input)
    const subscription = stream.subscribe({ next: (update) => received.push(update) })
    return { received, stop: () => subscription.unsubscribe() }
  }
  const list = async (input: Parameters<typeof caller.list>[0]) => {
    const { received, stop } = await updates(input)
    stop()
    const [first] = received
    if (first?.type !== 'list') throw new Error('The roster did not send its list first.')
    return first
  }
  const statusChanged = (sessionId: string) => {
    for (const listener of statusListeners) listener({ sessionId })
  }
  return {
    client,
    list,
    updates,
    roster,
    searchScans,
    statusChanged,
    watchedStatus,
    activities,
  }
}

export type SessionListUpdate = z.infer<typeof sessionListUpdateSchema>
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
    customTitle?: string | null
    preview?: string | null
    firstPrompt?: string | null
    cwd?: string | null
    workspaceId?: string | null
    activityAt?: number | null
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
      values.activityAt ?? values.updatedAt,
      values.updatedAt,
    )
}

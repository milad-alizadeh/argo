import { type inferRouterOutputs, initTRPC } from '@trpc/server'
import type { Database } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import { sessionArchive } from '@/database/session-archive/schema'
import { sessionTicketLink } from '@/database/session-ticket-link/schema'
import type { FeedActivityState } from '@/domains/sessions/api/feed-activity'
import {
  sessionDetailsProcedure,
  sessionListChangedProcedure,
  sessionListProcedure,
  watchSessionList,
} from '@/domains/sessions/main/api/session-list'
import { SessionListChanges } from '@/domains/sessions/main/api/session-list-changes'
import {
  type SessionUpdateProcedureContext,
  sessionUpdateProcedure,
} from '@/domains/sessions/main/api/session-update'
import type { LiveSessionSupervisorActor } from '@/domains/sessions/main/live'
import { saveReadTicket } from '@/domains/tickets/main/database/ticket-upsert'
import { insertProject, migratedDatabase } from '@/mocks/database/migrated-database'
import type { AppRouter } from '@/platform/main/trpc-router'

export const IDS = [
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
] as const

type SessionListChange = inferRouterOutputs<AppRouter>['sessionListChanged']
type RenameRequest = Parameters<SessionUpdateProcedureContext['rename']>[0]

// The provider scope every test Project's Tickets are saved under.
const TICKET_SCOPE = { provider: 'github', scope: 'octocat/hello-world' } as const

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

type SessionListCallerOptions = {
  // Mock live actors by Session ID, unless a test passes a real `supervisor`.
  sessions?: Record<string, unknown>
  supervisor?: LiveSessionSupervisorActor
  database?: Database
  rename?: (request: RenameRequest) => Promise<void>
}

// The Session List procedures over an in-memory database, with the app-level watcher main starts.
export function sessionListCaller({
  sessions = {},
  supervisor,
  database = migratedDatabase(),
  rename = async () => {},
}: SessionListCallerOptions = {}) {
  const mock = mockSupervisor(sessions)
  const changes = new SessionListChanges()
  const renames: RenameRequest[] = []
  const removalRequests: Parameters<SessionUpdateProcedureContext['removeSessionWorktrees']>[0][] =
    []
  const context = {
    database,
    supervisor: supervisor ?? (mock.supervisor as never),
    changes,
    ticketSource: async () => TICKET_SCOPE,
    rename: async (request: RenameRequest) => {
      renames.push(request)
      await rename(request)
    },
    removeSessionWorktrees: (input: (typeof removalRequests)[number]) => {
      removalRequests.push(input)
    },
  }
  const stopWatching = watchSessionList(context)
  const caller = initTRPC
    .create()
    .router({
      list: sessionListProcedure(context),
      changed: sessionListChangedProcedure(context),
      update: sessionUpdateProcedure(context),
      details: sessionDetailsProcedure(context),
    })
    .createCaller({})
  const subscribeChanges = async () => {
    const received: SessionListChange[] = []
    const stream = await caller.changed()
    const subscription = stream.subscribe({ next: (change) => received.push(change) })
    return { received, stop: () => subscription.unsubscribe() }
  }
  return {
    database,
    list: caller.list,
    update: caller.update,
    details: caller.details,
    changes: subscribeChanges,
    sessionListChanges: changes,
    stopWatching,
    statusChanged: mock.statusChanged,
    renames,
    removalRequests,
  }
}

export const settled = () => new Promise((resolve) => setTimeout(resolve, 0))

export function liveSession(
  state: string,
  status: string | null = null,
  activity: FeedActivityState['activity'] = null,
) {
  return {
    getSnapshot: () => ({
      value: state,
      matches: (candidate: string) => candidate === state,
      context: {
        status,
        activity: { activity, callId: null },
        turnConfiguration: { model: 'claude-sonnet', effort: 'high', mode: 'default' },
      },
    }),
  }
}

// Saves one Session, and its Project, with the stored columns a test names.
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

// Saves the provider's facts for one Ticket in the test Ticket scope, as a read newer than any.
export function saveTicket(
  database: Database,
  { key, title, state = 'open' }: { key: string; title: string; state?: 'open' | 'closed' },
) {
  saveReadTicket(
    database,
    { ...TICKET_SCOPE, readAt: Number.MAX_SAFE_INTEGER },
    {
      key,
      url: null,
      title,
      body: null,
      state,
      status: { id: state, name: state, category: state === 'open' ? 'unstarted' : 'completed' },
      priority: null,
      createdAt: '2026-09-01T00:00:00Z',
      labels: [],
      type: null,
      children: [],
      blockedBy: null,
    },
  )
}

// Links a Session to a Ticket by key, as the user asserts it.
export function linkTicket(
  database: Database,
  {
    createdAt = '2026-09-26T10:00:00.000Z',
    ...link
  }: { sessionId: string; key: string; createdAt?: string },
) {
  database
    .insert(sessionTicketLink)
    .values({ sessionId: link.sessionId, projectId: 'project-1', ticketKey: link.key, createdAt })
    .run()
}

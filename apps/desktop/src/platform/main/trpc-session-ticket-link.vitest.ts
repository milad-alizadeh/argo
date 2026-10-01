// A Ticket in a new Session's first draft becomes that Session's link (#2151, #2973).
import { afterEach, beforeEach, expect, test } from 'vitest'
import type { Database } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import { SessionListChanges } from '@/domains/sessions/main/api'
import type { LiveSessionSupervisorActor } from '@/domains/sessions/main/live'
import { createSessionTicketLinkStoreFromDatabase } from '@/domains/tickets/main/session-links'
import type { Harness } from '@/harnesses/harness'
import { insertWorkspace, migratedDatabase } from '@/mocks/database/migrated-database'
import { saveTicket, settled, TICKET_SCOPE } from '@/mocks/sessions/session-list-caller'
import { type AppRouterDependencies, createAppRouter } from './trpc-router'

const HARNESSES = ['claude', 'codex'] as const satisfies readonly Harness[]
const projectId = 'project-1'
const workspaceId = 'workspace-1'
const SESSION_ID = '00000000-0000-4000-8000-000000000001'

const draftTicket = (key: string) => ({
  id: `context-${key}`,
  provider: 'github' as const,
  key,
  title: `Draft title of ${key}`,
  status: 'Open',
  terminal: false,
  blocked: null,
})

let database: Database

beforeEach(() => {
  database = migratedDatabase()
  insertWorkspace(database, workspaceId, projectId)
  saveTicket(database, { key: '#2973', title: 'Connect the linked Ticket' })
})

afterEach(() => database.$client.close())

// The router with a supervisor that saves each started Session, as a live start does.
function api(harness: Harness) {
  const changes = new SessionListChanges()
  const announced: string[][] = []
  changes.subscribe((sessionIds) => announced.push([...sessionIds]))
  const save = (sessionId: string) =>
    database
      .insert(sessionTable)
      .values({
        argoId: sessionId,
        harness,
        nativeId: `native-${sessionId}`,
        projectId,
        workspaceId,
      })
      .onConflictDoNothing()
      .run()
  const send: LiveSessionSupervisorActor['send'] = (event) => {
    if (event.type === 'Start') {
      save(SESSION_ID)
      event.reply.resolve({ sessionId: SESSION_ID })
    } else if (event.type === 'Send') event.reply.resolve({ sessionId: event.input.sessionId })
  }
  const supervisor = {
    send,
    system: { get: () => undefined },
    getSnapshot: () => ({ context: { sessions: {}, starts: {} } }),
  }
  const exclusive = async <T>(work: () => Promise<T>) => work()
  const dependencies = {
    projects: { database, chooseFolder: async () => null, exclusive },
    workspaces: { database, exclusive },
    sessions: {
      database,
      supervisor,
      changes,
      ticketSource: async () => TICKET_SCOPE,
      ticketLinks: createSessionTicketLinkStoreFromDatabase(database),
      acceptsAttachments: () => true,
    },
  } as unknown as AppRouterDependencies
  return { caller: createAppRouter(dependencies).createCaller({}), announced, save }
}

const content = (tickets: ReturnType<typeof draftTicket>[]) => ({
  prompt: 'Start the work.',
  attachments: [],
  ticketContext: tickets,
  turnConfiguration: { model: 'model', effort: 'high', mode: 'default' },
})

async function submit(
  caller: ReturnType<typeof api>['caller'],
  draft: { id: string; revision: number },
) {
  return caller.sessionSubmit({
    draftId: draft.id,
    expectedRevision: draft.revision,
    commandId: `command-${draft.id}-${draft.revision}`,
  })
}

const linkedRows = (caller: ReturnType<typeof api>['caller'], ticketKey: string) =>
  caller.sessionList({ projectId, filter: 'all', search: '', ticketKey })

for (const harness of HARNESSES) {
  test(`a new ${harness} Session links to the first Ticket of its first draft`, async () => {
    const { caller, announced } = api(harness)
    const draft = await caller.composerDraftCreate({
      target: { type: 'project', projectId, workspaceId, harness },
      content: content([draftTicket('#2973'), draftTicket('#2974')]),
    })

    await submit(caller, draft)
    await settled()

    const { rows } = await linkedRows(caller, '#2973')
    expect(rows.map((row) => [row.id, row.name, row.ticket?.key, row.ticket?.title])).toEqual([
      [SESSION_ID, 'Connect the linked Ticket', '#2973', 'Connect the linked Ticket'],
    ])
    expect((await linkedRows(caller, '#2974')).rows).toEqual([])
    expect(announced).toContainEqual([SESSION_ID])
  })

  test(`a send to an existing ${harness} Session never changes its link`, async () => {
    const { caller, save } = api(harness)
    save(SESSION_ID)
    const draft = await caller.composerDraftCreate({
      target: { type: 'session', sessionId: SESSION_ID },
      content: content([draftTicket('#2973')]),
    })

    await submit(caller, draft)

    expect((await linkedRows(caller, '#2973')).rows).toEqual([])
  })

  test(`a first ${harness} draft with no Ticket writes no link`, async () => {
    const { caller } = api(harness)
    const draft = await caller.composerDraftCreate({
      target: { type: 'project', projectId, workspaceId, harness },
      content: content([]),
    })

    await submit(caller, draft)

    const { rows } = await caller.sessionList({ projectId, filter: 'all', search: '' })
    expect(rows.map((row) => [row.id, row.ticket])).toEqual([[SESSION_ID, null]])
  })
}

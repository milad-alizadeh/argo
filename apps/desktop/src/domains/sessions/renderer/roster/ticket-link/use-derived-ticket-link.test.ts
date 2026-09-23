import { afterEach, expect, test } from 'bun:test'
import { ticketListedSchema } from '@/domains/tickets/contract/contract'
import { createPendingTicketRenames, processDerivedSession } from './use-derived-ticket-link'
import { session, TICKET } from './use-session-ticket-link-fixtures'

const originalWindow = globalThis.window
afterEach(() => {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow })
})

function installTicketHost(rename: (name: string) => void) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      argo: {
        listTickets: async () =>
          ticketListedSchema.parse({
            version: 1,
            type: 'ticket.listed',
            requestId: 'tickets-1',
            projectId: TICKET.projectId,
            scope: 'repository',
            tickets: [
              {
                key: TICKET.key,
                url: null,
                title: TICKET.title,
                body: null,
                state: 'open',
                status: { id: 'open', name: 'Open', category: 'unstarted' },
                priority: null,
                createdAt: '2026-09-23T00:00:00.000Z',
                labels: [],
                type: null,
                children: [],
                blockedBy: null,
              },
            ],
            statuses: [],
            nextCursor: null,
            total: 1,
          }),
        renameSession: async ({ sessionId, name }: { sessionId: string; name: string }) => {
          rename(name)
          return {
            version: 1,
            type: 'session.renamed',
            requestId: 'rename-1',
            sessionId,
            title: name,
          }
        },
      },
    },
  })
}

test('retries ticket auto-rename after a watched Session becomes managed', async () => {
  let linked = false
  let renamedTitle: string | null = null
  const reportedFailures: string[] = []
  installTicketHost((name) => {
    renamedTitle = name
  })
  const pendingRenames = createPendingTicketRenames()
  const attempted = new Set<string>()
  const watched = {
    ...session('first-prompt'),
    branch: 'feature/ARGO-1',
    posture: 'watched' as const,
  }

  const shared = {
    attempted,
    pendingRenames,
    projectId: TICKET.projectId,
    reportFailure: (message) => reportedFailures.push(message),
  }
  await processDerivedSession({
    ...shared,
    connect: async () => {
      linked = true
      return {
        renamed: false,
        needsRenameConfirmation: false,
        renameFailure: 'Session is not drivable',
      }
    },
    session: watched,
  })
  expect(linked).toBe(true)
  expect(renamedTitle).toBeNull()
  expect(reportedFailures).toEqual(['Session is not drivable'])

  const managed = {
    ...watched,
    posture: 'managed' as const,
    ticket: {
      projectId: TICKET.projectId,
      key: TICKET.key,
      title: TICKET.title,
      state: 'open' as const,
      createdAt: '2026-09-23T00:00:00.000Z',
    },
  }
  await processDerivedSession({
    ...shared,
    connect: async () => {
      throw new Error('The linked Ticket must not be connected again.')
    },
    session: managed,
  })

  expect(renamedTitle).toBe(TICKET.title)
})

test('discards a pending auto-rename when the Session links a different Ticket', async () => {
  let renamedTitle: string | null = null
  installTicketHost((name) => {
    renamedTitle = name
  })
  const pendingRenames = createPendingTicketRenames()
  pendingRenames.queue('session-1', TICKET)

  await processDerivedSession({
    attempted: new Set(),
    connect: async () => {
      throw new Error('A Session with another linked Ticket must not be connected again.')
    },
    pendingRenames,
    projectId: TICKET.projectId,
    reportFailure: () => {},
    session: {
      ...session('first-prompt'),
      ticket: {
        projectId: TICKET.projectId,
        key: 'ARGO-2',
        title: 'Different Ticket',
        state: 'open',
        createdAt: '2026-09-23T00:00:00.000Z',
      },
    },
  })

  expect(renamedTitle).toBeNull()
  expect(pendingRenames.takeWhenManaged('session-1', 'managed', null)).toBeUndefined()
})

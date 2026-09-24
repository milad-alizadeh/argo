import { afterEach, expect, test } from 'bun:test'
import { ticketReadSchema } from '@/domains/tickets/contract/contract'
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
        readTicket: async () =>
          ticketReadSchema.parse({
            version: 1,
            type: 'ticket.read',
            requestId: 'tickets-1',
            projectId: TICKET.projectId,
            scope: 'repository',
            ticket: {
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
            statuses: [],
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

async function retryManagedRename(options: {
  session: ReturnType<typeof session>
  attempted: Set<string>
  pendingRenames: ReturnType<typeof createPendingTicketRenames>
  renamed: (title: string, confirmed: boolean) => void
}) {
  const { session: managed, attempted, pendingRenames, renamed } = options
  await processDerivedSession({
    attempted,
    pendingRenames,
    projectId: TICKET.projectId,
    reportFailure: () => {},
    connect: async (_current, ticket, connectOptions) => {
      renamed(ticket.title, connectOptions?.confirmedRename === true)
      return { failure: null, renamed: true, needsRenameConfirmation: false, renameFailure: null }
    },
    session: managed,
  })
}

function managedSession(watched: ReturnType<typeof session>) {
  return {
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
}

test('retries ticket auto-rename after a watched Session becomes managed', async () => {
  let linked = false
  let renamedTitle: string | null = null
  let confirmedRename = false
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
    connect: async (_current, ticket, options) => {
      if (_current.posture === 'managed') {
        confirmedRename = options?.confirmedRename === true
        renamedTitle = ticket.title
        return {
          failure: null,
          renamed: true,
          needsRenameConfirmation: false,
          renameFailure: null,
        }
      }
      linked = true
      return {
        failure: null,
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

  const managed = managedSession(watched)
  await retryManagedRename({
    session: managed,
    attempted,
    pendingRenames,
    renamed: (title, confirmed) => {
      renamedTitle = title
      confirmedRename = confirmed
    },
  })

  expect(renamedTitle).toBe(TICKET.title)
  expect(confirmedRename).toBe(true)
})

test('links a closed branch Ticket with its exact title', async () => {
  const closedTicket = {
    key: '#2582',
    url: 'https://github.com/milad-alizadeh/argo/issues/2582',
    title: 'Drive managed Claude Sessions',
    body: null,
    state: 'closed',
    status: { id: 'closed', name: 'Closed', category: 'completed' },
    priority: null,
    createdAt: '2026-09-23T00:00:00.000Z',
    labels: [],
    type: null,
    children: [],
    blockedBy: [],
  }
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      argo: {
        readTicket: async () =>
          ticketReadSchema.parse({
            version: 1,
            type: 'ticket.read',
            requestId: 'ticket-1',
            projectId: TICKET.projectId,
            scope: 'milad-alizadeh/argo',
            ticket: closedTicket,
            statuses: [],
          }),
      },
    },
  })
  let linked: { key: string; title: string; state: 'open' | 'closed' } | null = null
  let customTitlePreserved = false

  await processDerivedSession({
    attempted: new Set(),
    pendingRenames: createPendingTicketRenames(),
    projectId: TICKET.projectId,
    reportFailure: () => {},
    session: { ...session('custom'), branch: 'argo/#2582-drive-managed-claude-sessions' },
    connect: async (_session, ticket, options) => {
      linked = ticket
      customTitlePreserved = options?.preserveCustomTitle === true
      return { failure: null, renamed: true, needsRenameConfirmation: false, renameFailure: null }
    },
  })

  expect(linked).toEqual({
    projectId: TICKET.projectId,
    key: '#2582',
    title: 'Drive managed Claude Sessions',
    state: 'closed',
  })
  expect(customTitlePreserved).toBe(true)
})

test('renames a linked non-custom Session when its title differs from the Ticket', async () => {
  let linked: { key: string; title: string; state: 'open' | 'closed' } | null = null
  let renamedTitle: string | null = null
  installTicketHost((name) => {
    renamedTitle = name
  })

  await processDerivedSession({
    attempted: new Set(),
    pendingRenames: createPendingTicketRenames(),
    projectId: TICKET.projectId,
    reportFailure: () => {},
    session: {
      ...session('summarised'),
      title: { text: 'Old Ticket title', source: 'summarised' },
      ticket: {
        ...TICKET,
        title: 'Old Ticket title',
        createdAt: '2026-09-23T00:00:00.000Z',
      },
    },
    connect: async (_session, ticket) => {
      linked = ticket
      renamedTitle = ticket.title
      return { failure: null, renamed: true, needsRenameConfirmation: false, renameFailure: null }
    },
  })

  expect(linked?.title).toBe(TICKET.title)
  expect(renamedTitle).toBe(TICKET.title)
})

test('preserves a custom Session name when its existing Ticket title differs', async () => {
  let optionsSeen: { confirmedRename?: boolean; preserveCustomTitle?: boolean } | undefined
  installTicketHost(() => {})
  await processDerivedSession({
    attempted: new Set(),
    pendingRenames: createPendingTicketRenames(),
    projectId: TICKET.projectId,
    reportFailure: () => {},
    session: {
      ...session('custom'),
      ticket: { ...TICKET, title: 'Old Ticket title', createdAt: '2026-09-23T00:00:00.000Z' },
    },
    connect: async (_session, _ticket, options) => {
      optionsSeen = options
      return { failure: null, renamed: true, needsRenameConfirmation: false, renameFailure: null }
    },
  })

  expect(optionsSeen).toEqual({ preserveCustomTitle: true })
})

test('reports a failed Ticket read while syncing a linked Session title', async () => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { argo: { readTicket: async () => Promise.reject(new Error('Ticket read failed')) } },
  })
  const reported: string[] = []

  await processDerivedSession({
    attempted: new Set(),
    pendingRenames: createPendingTicketRenames(),
    projectId: TICKET.projectId,
    reportFailure: (message) => reported.push(message),
    session: {
      ...session('summarised'),
      ticket: { ...TICKET, title: 'Old Ticket title', createdAt: '2026-09-23T00:00:00.000Z' },
    },
    connect: async () => {
      throw new Error('A Session cannot be renamed without a Ticket read.')
    },
  })

  expect(reported).toEqual(['Ticket read failed'])
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
  expect(
    pendingRenames.takeWhenManaged({
      sessionId: 'session-1',
      posture: 'managed',
      linkedTicket: null,
    }),
  ).toBeUndefined()
})

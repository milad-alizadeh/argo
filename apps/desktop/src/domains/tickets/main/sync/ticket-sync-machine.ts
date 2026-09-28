// One scan of a scope's active Tickets: each page commits before the next; the last sets coverage.
import { assign, fromPromise, setup } from 'xstate'
import type { Database } from '@/database/database'
import type { TicketScopeTarget } from '@/database/ticket/validation'
import type { Ticket, TicketErrorCode, TicketStatus } from '@/domains/tickets/contract/contract'
import { saveListedTickets } from '../database/ticket-upsert'
import type { TicketPage } from '../sources'
import {
  beginTicketScan,
  completeTicketScan,
  failTicketScan,
  type TicketSyncTarget,
} from './ticket-sync-records'

export type PageRead =
  | {
      ok: true
      value: TicketPage
    }
  | {
      ok: false
      failure: TicketErrorCode
    }

export type TicketSyncRequest = TicketScopeTarget & {
  accountId: string
}

export type TicketSyncDependencies = {
  database: Database
  // One active page of the scope, read as the Account through Account access.
  readPage: (request: TicketSyncRequest, cursor: string | null) => Promise<PageRead>
  // Called after every commit that can change what a Ticket query answers.
  changed: (target: TicketScopeTarget) => void
}

type ScanInput = {
  dependencies: TicketSyncDependencies
  target: TicketSyncTarget
}
export type SavePageInput = ScanInput & {
  scanStartedAt: number
  readAt: number
  tickets: readonly Ticket[]
  offset: number
}
export type CompleteInput = ScanInput & {
  statuses: readonly TicketStatus[]
}
export type RecordFailureInput = ScanInput & {
  failure: TicketErrorCode
}

function commit<Result>(
  { dependencies, target }: ScanInput,
  write: (database: Database) => Result,
) {
  const result = write(dependencies.database)
  dependencies.changed({
    provider: target.provider,
    scope: target.scope,
  })
  return result
}

const scanInput = ({ dependencies, target }: ScanInput): ScanInput => ({
  dependencies,
  target,
})

const mergedStatuses = (saved: readonly TicketStatus[], offered: readonly TicketStatus[]) => [
  ...saved,
  ...offered.filter(({ id }) => !saved.some((status) => status.id === id)),
]

export const ticketSyncMachine = setup({
  types: {
    input: {} as ScanInput & {
      accountId: string
    },
    context: {} as ScanInput & {
      // The Account the scan reads as; the token stays with Account access.
      accountId: string
      // The scan's start, which is also the listing mark every page of this scan writes.
      scanStartedAt: number
      cursor: string | null
      // Every cursor this scan asked for, so a provider that cycles back to one fails the scan.
      cursors: string[]
      // When the page being read was asked for.
      readAt: number
      page: TicketPage | null
      // Every status any page offered, so a later page cannot drop one an earlier page listed.
      statuses: TicketStatus[]
      offset: number
      failure: TicketErrorCode | null
    },
  },
  actors: {
    begin: fromPromise<number, ScanInput>(async ({ input }) => {
      return commit(input, (database) => beginTicketScan(database, input.target, Date.now()))
    }),
    fetchPage: fromPromise<
      PageRead,
      ScanInput & {
        accountId: string
        cursor: string | null
      }
    >(({ input }) =>
      input.dependencies.readPage(
        {
          ...input.target,
          accountId: input.accountId,
        },
        input.cursor,
      ),
    ),
    savePage: fromPromise<void, SavePageInput>(async ({ input }) => {
      const { target, scanStartedAt, offset, readAt } = input
      commit(input, (database) =>
        saveListedTickets(
          database,
          {
            ...target,
            scanStartedAt,
            offset,
            readAt,
          },
          input.tickets,
        ),
      )
    }),
    complete: fromPromise<void, CompleteInput>(async ({ input }) => {
      commit(input, (database) =>
        completeTicketScan(database, input.target, {
          statuses: input.statuses,
          completedAt: Date.now(),
        }),
      )
    }),
    recordFailure: fromPromise<void, RecordFailureInput>(async ({ input }) => {
      commit(input, (database) => failTicketScan(database, input.target, input.failure))
    }),
  },
  guards: {
    'if the read failed': (_, read: PageRead) => !read.ok,
    // A provider that answers a cursor this scan already asked for would be read forever.
    'if the provider repeated a cursor': (
      _,
      {
        read,
        cursors,
      }: {
        read: PageRead
        cursors: readonly string[]
      },
    ) => read.ok && read.value.nextCursor !== null && cursors.includes(read.value.nextCursor),
    'if another page follows': ({ context }) => context.page?.nextCursor != null,
  },
  actions: {
    advance: assign({
      cursor: ({ context }) => context.page?.nextCursor ?? null,
      cursors: ({ context }) =>
        context.page?.nextCursor
          ? [
              ...context.cursors,
              context.page.nextCursor,
            ]
          : context.cursors,
      offset: ({ context }) => context.offset + (context.page?.tickets.length ?? 0),
    }),
  },
}).createMachine({
  id: 'ticketSync',
  initial: 'Starting',
  context: ({ input }) => ({
    dependencies: input.dependencies,
    target: input.target,
    accountId: input.accountId,
    scanStartedAt: 0,
    cursor: null,
    cursors: [],
    readAt: 0,
    page: null,
    statuses: [],
    offset: 0,
    failure: null,
  }),
  states: {
    Starting: {
      invoke: {
        src: 'begin',
        input: ({ context }) => scanInput(context),
        onDone: {
          target: 'Fetching',
          actions: assign({
            scanStartedAt: ({ event }) => event.output,
          }),
        },
        onError: {
          target: 'Failing',
          actions: assign({
            failure: 'storage-not-written' as const,
          }),
        },
      },
    },
    Fetching: {
      entry: assign({
        readAt: () => Date.now(),
      }),
      invoke: {
        src: 'fetchPage',
        input: ({ context }) => ({
          ...scanInput(context),
          accountId: context.accountId,
          cursor: context.cursor,
        }),
        onDone: [
          {
            guard: {
              type: 'if the read failed',
              params: ({ event }) => event.output,
            },
            target: 'Failing',
            actions: assign({
              failure: ({ event }) => (event.output.ok ? null : event.output.failure),
            }),
          },
          {
            guard: {
              type: 'if the provider repeated a cursor',
              params: ({ context, event }) => ({
                read: event.output,
                cursors: context.cursors,
              }),
            },
            target: 'Failing',
            actions: assign({
              failure: 'invalid-response' as const,
            }),
          },
          {
            target: 'Saving',
            actions: assign(({ context, event }) => {
              const page = event.output.ok ? event.output.value : null
              return {
                page,
                statuses: mergedStatuses(context.statuses, page?.statuses ?? []),
              }
            }),
          },
        ],
        onError: {
          target: 'Failing',
          actions: assign({
            failure: 'invalid-response' as const,
          }),
        },
      },
    },
    Saving: {
      invoke: {
        src: 'savePage',
        input: ({ context }) => ({
          ...scanInput(context),
          scanStartedAt: context.scanStartedAt,
          readAt: context.readAt,
          tickets: context.page?.tickets ?? [],
          offset: context.offset,
        }),
        onDone: [
          {
            guard: 'if another page follows',
            target: 'Fetching',
            actions: 'advance',
          },
          {
            target: 'Completing',
          },
        ],
        onError: {
          target: 'Failing',
          actions: assign({
            failure: 'storage-not-written' as const,
          }),
        },
      },
    },
    Completing: {
      invoke: {
        src: 'complete',
        input: ({ context }) => ({
          ...scanInput(context),
          statuses: context.statuses,
        }),
        onDone: 'Ready',
        onError: {
          target: 'Failing',
          actions: assign({
            failure: 'storage-not-written' as const,
          }),
        },
      },
    },
    Failing: {
      invoke: {
        src: 'recordFailure',
        input: ({ context }) => ({
          ...scanInput(context),
          failure: context.failure ?? 'invalid-response',
        }),
        onDone: 'Failed',
        onError: 'Failed',
      },
    },
    Ready: {
      type: 'final',
    },
    Failed: {
      type: 'final',
    },
  },
})

// One scan of a scope's active Tickets: each page commits before the next; the last sets coverage.
// A Closed scan reads a single page, the first or the one after the saved cursor.
import { assign, fromPromise, setup } from 'xstate'
import type { Database } from '@/database/database'
import type { TicketScopeTarget } from '@/database/ticket/validation'
import type { Ticket, TicketErrorCode, TicketStatus } from '@/domains/tickets/contract/contract'
import { countClosedListed, saveClosedTickets, saveListedTickets } from '../database/ticket-upsert'
import type { TicketPage } from '../sources'
import {
  beginScan,
  completeClosedPage,
  completeTicketScan,
  failTicketScan,
  type ScanStart,
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
  // Which listing to read; the open backlog unless a Closed page is asked for.
  state?: 'open' | 'closed'
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
type BeginInput = ScanInput & {
  // A Closed scan reads the page after the saved cursor rather than the first.
  more: boolean
}
export type SavePageInput = ScanInput & {
  scanStartedAt: number
  readAt: number
  tickets: readonly Ticket[]
  offset: number
  first: boolean
  nextCursor: string | null
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
    input: {} as BeginInput & {
      accountId: string
    },
    context: {} as BeginInput & {
      // The Account the scan reads as; the token stays with Account access.
      accountId: string
      // Whether the page being saved starts its listing over.
      first: boolean
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
    begin: fromPromise<ScanStart, BeginInput>(async ({ input }) => {
      return commit(input, (database) =>
        beginScan(database, input.target, {
          more: input.more,
          now: Date.now(),
        }),
      )
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
          state: input.target.kind === 'closed' ? 'closed' : 'open',
        },
        input.cursor,
      ),
    ),
    // A Closed page and its cursor commit together, so a later failure leaves the listing as saved.
    savePage: fromPromise<void, SavePageInput>(async ({ input }) => {
      const { target, scanStartedAt, offset, readAt, first, nextCursor } = input
      commit(input, (database) => {
        if (target.kind === 'active')
          return saveListedTickets(
            database,
            {
              ...target,
              scanStartedAt,
              offset,
              readAt,
            },
            input.tickets,
          )
        const start = first ? 0 : countClosedListed(database, target)
        saveClosedTickets(
          database,
          {
            ...target,
            offset: start,
            readAt,
            first,
          },
          input.tickets,
        )
        completeClosedPage(database, target, {
          nextCursor,
          completedAt: Date.now(),
        })
      })
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
    // A Closed scan is one page; the person asks for the next.
    'if another page follows': ({ context }) =>
      context.target.kind === 'active' && context.page?.nextCursor != null,
    'if the scan is Closed': ({ context }) => context.target.kind === 'closed',
    'if nothing follows the saved cursor': (_, start: ScanStart) => start.exhausted,
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
    more: input.more,
    first: true,
    scanStartedAt: 0,
    cursor: null,
    cursors: [],
    readAt: 0,
    page: null,
    statuses: [],
    offset: 0,
    failure: null,
  }),
  // The supervisor backs off on a failed scan and polls again after a complete one.
  output: ({ context }) => ({
    failure: context.failure,
  }),
  states: {
    Starting: {
      invoke: {
        src: 'begin',
        input: ({ context }) => ({
          ...scanInput(context),
          more: context.more,
        }),
        onDone: [
          {
            guard: {
              type: 'if nothing follows the saved cursor',
              params: ({ event }) => event.output,
            },
            target: 'Ready',
          },
          {
            target: 'Fetching',
            actions: assign(({ event }) =>
              event.output.exhausted
                ? {}
                : {
                    scanStartedAt: event.output.scanStartedAt,
                    cursor: event.output.cursor,
                    first: event.output.first,
                  },
            ),
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
          first: context.first,
          nextCursor: context.page?.nextCursor ?? null,
        }),
        onDone: [
          {
            guard: 'if another page follows',
            target: 'Fetching',
            actions: 'advance',
          },
          {
            guard: 'if the scan is Closed',
            target: 'Ready',
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

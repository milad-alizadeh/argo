// One scan of one provider scope's active Tickets: every page read in order, each committed before
// the next is asked for, and coverage recorded only once the last page commits.
import { assign, fromPromise, setup } from 'xstate'
import type { Database } from '@/database/database'
import type { Ticket, TicketErrorCode, TicketStatus } from '@/domains/tickets/contract/contract'
import { saveListedTickets, type TicketScopeTarget } from '../database/ticket-upsert'
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

type Step = {
  dependencies: TicketSyncDependencies
  target: TicketSyncTarget
}
export type SavePageInput = Step & {
  scanStartedAt: number
  tickets: readonly Ticket[]
  offset: number
}
export type CompleteInput = Step & {
  statuses: readonly TicketStatus[]
}
export type RecordFailureInput = Step & {
  failure: TicketErrorCode
}

function commit({ dependencies, target }: Step, write: (database: Database) => void) {
  write(dependencies.database)
  dependencies.changed({
    provider: target.provider,
    scope: target.scope,
  })
}

const step = ({ dependencies, target }: Step): Step => ({
  dependencies,
  target,
})

export const ticketSyncMachine = setup({
  types: {
    input: {} as Step & {
      accountId: string
    },
    context: {} as Step & {
      // The Account the scan reads as; the token stays with Account access.
      accountId: string
      // The scan's start, which is also the listing mark every page of this scan writes.
      scanStartedAt: number
      cursor: string | null
      page: TicketPage | null
      offset: number
      failure: TicketErrorCode | null
    },
  },
  actors: {
    begin: fromPromise<number, Step>(async ({ input }) => {
      const startedAt = Date.now()
      commit(input, (database) => beginTicketScan(database, input.target, startedAt))
      return startedAt
    }),
    fetchPage: fromPromise<
      PageRead,
      Step & {
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
      const { target, scanStartedAt, offset } = input
      commit(input, (database) =>
        saveListedTickets(
          database,
          {
            ...target,
            scanStartedAt,
            offset,
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
    'if another page follows': ({ context }) => context.page?.nextCursor != null,
  },
  actions: {
    advance: assign({
      cursor: ({ context }) => context.page?.nextCursor ?? null,
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
    page: null,
    offset: 0,
    failure: null,
  }),
  states: {
    Starting: {
      invoke: {
        src: 'begin',
        input: ({ context }) => step(context),
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
      invoke: {
        src: 'fetchPage',
        input: ({ context }) => ({
          ...step(context),
          accountId: context.accountId,
          cursor: context.cursor,
        }),
        onDone: [
          {
            guard: ({ event }) => !event.output.ok,
            target: 'Failing',
            actions: assign({
              failure: ({ event }) => (event.output.ok ? null : event.output.failure),
            }),
          },
          {
            // A provider that answers the cursor it was asked with would be read forever.
            guard: ({ context, event }) =>
              event.output.ok &&
              event.output.value.nextCursor !== null &&
              event.output.value.nextCursor === context.cursor,
            target: 'Failing',
            actions: assign({
              failure: 'invalid-response' as const,
            }),
          },
          {
            target: 'Saving',
            actions: assign({
              page: ({ event }) => (event.output.ok ? event.output.value : null),
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
          ...step(context),
          scanStartedAt: context.scanStartedAt,
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
          ...step(context),
          statuses: context.page?.statuses ?? [],
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
          ...step(context),
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

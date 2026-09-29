// One provider search of a scope: the first page of matches is read and committed with its links to
// the query, and only then does the screen learn of it.
import { assign, fromPromise, setup } from 'xstate'
import type { Database } from '@/database/database'
import type { TicketErrorCode } from '@/domains/tickets/api/messages'
import { saveSearchedTickets } from '../database/ticket-upsert'
import {
  beginTicketSearch,
  failTicketSearch,
  type TicketSearchTarget,
} from './ticket-search-records'
import { commit, type TicketSyncDependencies, type TicketSyncRequest } from './ticket-sync-machine'

export type TicketSearchRequest = TicketSyncRequest & {
  query: string
}

type SearchInput = {
  dependencies: TicketSyncDependencies
  target: TicketSearchTarget
  accountId: string
}

// The provider's answer to the query; a read that throws is an invalid response.
async function readMatches({ dependencies, target, accountId }: SearchInput) {
  const read = await dependencies
    .readPage(
      {
        ...target,
        accountId,
      },
      null,
    )
    .catch(() => null)
  return (
    read ??
    ({
      ok: false,
      failure: 'invalid-response',
    } as const)
  )
}

// The failure the search ended with, or null once its matches are committed.
async function search(input: SearchInput): Promise<TicketErrorCode | null> {
  const { target } = input
  const record = (write: (database: Database) => void) => commit(input, write)
  try {
    record((database) => beginTicketSearch(database, target))
    const readAt = Date.now()
    const read = await readMatches(input)
    if (read.ok) {
      const { tickets } = read.value
      record((database) =>
        saveSearchedTickets(
          database,
          {
            ...target,
            readAt,
            completedAt: Date.now(),
          },
          tickets,
        ),
      )
      return null
    }
    record((database) => failTicketSearch(database, target, read.failure))
    return read.failure
  } catch {
    // Best effort: with storage down, the interrupted-search sweep settles the row at restart.
    try {
      record((database) => failTicketSearch(database, target, 'storage-not-written'))
    } catch {}
    return 'storage-not-written'
  }
}

export const ticketSearchMachine = setup({
  types: {
    input: {} as SearchInput,
    context: {} as SearchInput & {
      failure: TicketErrorCode | null
    },
  },
  actors: {
    search: fromPromise<TicketErrorCode | null, SearchInput>(({ input }) => search(input)),
  },
}).createMachine({
  id: 'ticketSearch',
  initial: 'Searching',
  context: ({ input }) => ({
    ...input,
    failure: null,
  }),
  output: ({ context }) => ({
    failure: context.failure,
  }),
  states: {
    Searching: {
      invoke: {
        src: 'search',
        input: ({ context }) => context,
        onDone: {
          target: 'Done',
          actions: assign({
            failure: ({ event }) => event.output,
          }),
        },
        onError: 'Done',
      },
    },
    Done: {
      type: 'final',
    },
  },
})

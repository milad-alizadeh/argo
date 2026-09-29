import assert from 'node:assert/strict'
import { test } from 'vitest'
import { createActor, fromPromise, toPromise } from 'xstate'
import type { Database } from '@/database/database'
import type { Ticket, TicketStatus } from '@/domains/tickets/contract/contract'
import type { TicketPage } from '../sources'
import {
  type CompleteInput,
  type PageRead,
  type RecordFailureInput,
  type SavePageInput,
  ticketSyncMachine,
} from './ticket-sync-machine'

const TARGET = { provider: 'github', scope: 'octocat/hello-world', kind: 'active' } as const
const OPEN: TicketStatus = { id: 'open', name: 'Open', category: 'unstarted' }
const DONE: TicketStatus = { id: 'done', name: 'Done', category: 'completed' }

const tickets = (...keys: string[]) => keys.map((key) => ({ key }) as Ticket)
const page = (keys: string[], nextCursor: string | null): TicketPage => ({
  tickets: tickets(...keys),
  statuses: [OPEN],
  nextCursor,
  total: null,
})

function run(pages: Record<string, PageRead>) {
  const writes: string[] = []
  const machine = ticketSyncMachine.provide({
    actors: {
      begin: fromPromise(async () => {
        writes.push('begin')
        return 1
      }),
      savePage: fromPromise(async ({ input }: { input: SavePageInput }) => {
        writes.push(`save ${input.offset} ${input.tickets.map(({ key }) => key).join(',')}`)
      }),
      complete: fromPromise(async ({ input }: { input: CompleteInput }) => {
        writes.push(`complete ${input.statuses.map(({ id }) => id).join(',')}`)
      }),
      recordFailure: fromPromise(async ({ input }: { input: RecordFailureInput }) => {
        writes.push(`fail ${input.failure}`)
      }),
    },
  })
  const actor = createActor(machine, {
    input: {
      dependencies: {
        database: {} as Database,
        readPage: async (_request, cursor) => {
          const read = pages[cursor ?? 'first']
          if (read === undefined) throw new Error(`No page ${cursor}`)
          return read
        },
        changed: () => {},
      },
      target: TARGET,
      accountId: 'github:583231',
    },
  }).start()
  return { writes, done: toPromise(actor), actor }
}

test('reads every page in order and completes only after the last page commits', async () => {
  const sync = run({
    first: { ok: true, value: page(['#609', '#607'], '2') },
    '2': { ok: true, value: page(['#273'], null) },
  })
  await sync.done
  assert.equal(sync.actor.getSnapshot().value, 'Ready')
  assert.deepEqual(sync.writes, ['begin', 'save 0 #609,#607', 'save 2 #273', 'complete open'])
})

test('a failed page keeps the committed pages and never completes the scan', async () => {
  const sync = run({
    first: { ok: true, value: page(['#1'], '2') },
    '2': { ok: false, failure: 'github-unreachable' },
  })
  await sync.done
  assert.equal(sync.actor.getSnapshot().value, 'Failed')
  assert.deepEqual(sync.writes, ['begin', 'save 0 #1', 'fail github-unreachable'])
})

test('a provider that answers the same cursor again fails rather than looping', async () => {
  const sync = run({
    first: { ok: true, value: page(['#1'], '2') },
    '2': { ok: true, value: page(['#2'], '2') },
  })
  await sync.done
  assert.deepEqual(sync.writes, ['begin', 'save 0 #1', 'fail invalid-response'])
})

test('a provider that cycles back to an earlier cursor fails rather than looping', async () => {
  const sync = run({
    first: { ok: true, value: page(['#1'], '2') },
    '2': { ok: true, value: page(['#2'], '3') },
    '3': { ok: true, value: page(['#3'], '2') },
  })
  await sync.done
  assert.deepEqual(sync.writes, ['begin', 'save 0 #1', 'save 1 #2', 'fail invalid-response'])
})

test('a page read that throws is recorded as an invalid response', async () => {
  const sync = run({})
  await sync.done
  assert.deepEqual(sync.writes, ['begin', 'fail invalid-response'])
})

test('the completed scan keeps every status any page offered, once each', async () => {
  const sync = run({
    first: { ok: true, value: { ...page(['#1'], '2'), statuses: [OPEN, DONE] } },
    '2': { ok: true, value: { ...page(['#2'], null), statuses: [DONE] } },
  })
  await sync.done
  assert.equal(sync.writes.at(-1), 'complete open,done')
})

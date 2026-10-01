import assert from 'node:assert/strict'
import { test } from 'vitest'
import type { Harness } from '@/harnesses/harness'
import { migratedDatabase } from '@/mocks/database/migrated-database'
import {
  commitTicket,
  IDS,
  insertSession,
  linkTicket,
  saveTicket,
  sessionListCaller,
  TICKET_SCOPE,
} from '@/mocks/sessions/session-list-caller'

const HARNESSES = ['claude', 'codex'] as const satisfies readonly Harness[]
const LATER_ID = '00000000-0000-4000-8000-000000000004'

// Two Sessions on #607 and one on #608, all of one Harness, saved before the watcher starts.
async function linkedSessions(harness: Harness) {
  const database = migratedDatabase()
  saveTicket(database, { key: '#607', title: 'Plan the work' })
  saveTicket(database, { key: '#608', title: 'Other work' })
  IDS.forEach((id, index) => {
    insertSession(database, { id, harness, nativeId: `native-${index}`, createdAt: 30 - index })
  })
  linkTicket(database, { sessionId: IDS[0], key: '#607' })
  linkTicket(database, { sessionId: IDS[1], key: '#607' })
  linkTicket(database, { sessionId: IDS[2], key: '#608' })
  const caller = sessionListCaller({ database })
  await caller.ticketsWatched()
  return caller
}

// The Session List changes announced while #607 is saved again with the facts it already has.
async function namedByUnchangedSave(caller: Awaited<ReturnType<typeof linkedSessions>>) {
  const { received, stop } = await caller.changes()
  saveTicket(caller.database, { key: '#607', title: 'Plan the work' })
  caller.ticketChanges.changed(TICKET_SCOPE)
  await caller.ticketsWatched()
  stop()
  return received
}

for (const harness of HARNESSES) {
  test(`a ${harness} Session List names the Sessions whose Ticket changed`, async () => {
    const { database, changes, list, ticketChanges, ticketsWatched } = await linkedSessions(harness)
    try {
      const { received, stop } = await changes()

      commitTicket(database, ticketChanges, {
        key: '#607',
        title: 'Plan the work',
        state: 'closed',
      })
      await ticketsWatched()
      stop()

      assert.deepEqual(received, [{ sessionIds: [IDS[0], IDS[1]] }])
      const read = await list({
        projectId: 'project-1',
        filter: 'all',
        search: '',
        ticketKey: '#607',
      })
      assert.deepEqual(
        read.rows.map((row) => row.ticket?.state),
        ['closed', 'closed'],
      )
    } finally {
      database.$client.close()
    }
  })

  test(`a ${harness} Ticket save that changes nothing names no Session`, async () => {
    const caller = await linkedSessions(harness)
    try {
      assert.deepEqual(await namedByUnchangedSave(caller), [])
    } finally {
      caller.database.$client.close()
    }
  })

  test(`a ${harness} Session linked after the watcher starts is not named by an unchanged save`, async () => {
    const caller = await linkedSessions(harness)
    const { database, sessionListChanges, ticketsWatched } = caller
    try {
      insertSession(database, { id: LATER_ID, harness, nativeId: 'native-later', createdAt: 40 })
      linkTicket(database, { sessionId: LATER_ID, key: '#607' })
      sessionListChanges.changed([LATER_ID])
      // The announcement lands a microtask later, and queues the watcher's read of the link.
      await Promise.resolve()
      await ticketsWatched()

      assert.deepEqual(await namedByUnchangedSave(caller), [])
    } finally {
      database.$client.close()
    }
  })
}

test('a change in another provider scope names no Session', async () => {
  const { database, changes, ticketChanges, ticketsWatched } = await linkedSessions('claude')
  try {
    const { received, stop } = await changes()

    saveTicket(database, { key: '#607', title: 'Renamed', state: 'closed' })
    ticketChanges.changed({ provider: 'linear', scope: 'team-engine' })
    await ticketsWatched()
    stop()

    assert.deepEqual(received, [])
  } finally {
    database.$client.close()
  }
})

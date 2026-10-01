import assert from 'node:assert/strict'
import { test } from 'vitest'
import type { Harness } from '@/harnesses/harness'
import { migratedDatabase } from '@/mocks/database/migrated-database'
import {
  IDS,
  insertSession,
  linkTicket,
  saveTicket,
  sessionListCaller,
  settled,
  TICKET_SCOPE,
} from '@/mocks/sessions/session-list-caller'

const HARNESSES = ['claude', 'codex'] as const satisfies readonly Harness[]

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

for (const harness of HARNESSES) {
  test(`a ${harness} Session List names the Sessions whose Ticket changed`, async () => {
    const { database, changes, list, ticketChanges } = await linkedSessions(harness)
    try {
      const { received, stop } = await changes()

      saveTicket(database, { key: '#607', title: 'Plan the work', state: 'closed' })
      ticketChanges.changed(TICKET_SCOPE)
      await settled()
      await settled()
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
    const { database, changes, ticketChanges } = await linkedSessions(harness)
    try {
      const { received, stop } = await changes()

      saveTicket(database, { key: '#607', title: 'Plan the work' })
      ticketChanges.changed(TICKET_SCOPE)
      await settled()
      await settled()
      stop()

      assert.deepEqual(received, [])
    } finally {
      database.$client.close()
    }
  })
}

test('a change in another provider scope names no Session', async () => {
  const { database, changes, ticketChanges } = await linkedSessions('claude')
  try {
    const { received, stop } = await changes()

    saveTicket(database, { key: '#607', title: 'Renamed', state: 'closed' })
    ticketChanges.changed({ provider: 'linear', scope: 'team-engine' })
    await settled()
    await settled()
    stop()

    assert.deepEqual(received, [])
  } finally {
    database.$client.close()
  }
})

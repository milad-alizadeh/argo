// Argo names each Session with an id of its own when it first lists it, so a case that names a
// fixture reads that id back from the app's database by the Harness's id for the fixture.
import { DatabaseSync } from 'node:sqlite'
import { setTimeout } from 'node:timers/promises'
import { databasePath } from '@/database/database'
import { fixtureSessionId } from '../../mocks/sessions/mock-transcript-files'

const LISTED_TIMEOUT_MS = 30_000

let store: string | null = null

// The app data the running case launched against; set by the Session fixture before a case runs.
export function readFixtureSessionsFrom(userData: string | null) {
  store = userData
}

function argoIdOf(nativeId: string): string | undefined {
  if (store === null) throw new Error('No Session fixture is running.')
  const database = new DatabaseSync(databasePath(store), { readOnly: true })
  try {
    const row = database.prepare('SELECT argo_id FROM session WHERE native_id = ?').get(nativeId) as
      | { argo_id: string }
      | undefined
    return row?.argo_id
  } finally {
    database.close()
  }
}

// Waits for the app to list the fixture, then answers with the id its Roster row carries.
export async function fixtureSession(name: string): Promise<string> {
  const nativeId = fixtureSessionId(name)
  const deadline = Date.now() + LISTED_TIMEOUT_MS
  for (;;) {
    const argoId = argoIdOf(nativeId)
    if (argoId !== undefined) return argoId
    if (Date.now() > deadline) throw new Error(`The app never listed the ${name} fixture.`)
    await setTimeout(100)
  }
}

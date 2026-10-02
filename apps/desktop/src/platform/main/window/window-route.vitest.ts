import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'vitest'
import { insertProject, migratedDatabase } from '@/mocks/database/migrated-database'
import { insertSession } from '@/mocks/sessions/session-list-caller'
import { writeDocument } from '../storage/portable-file'
import { readWindowRoute, windowRoutePath } from './window-route'

const SESSION = '00000000-0000-4000-8000-000000000001'
const OTHER_PROJECT_SESSION = '00000000-0000-4000-8000-000000000002'

async function savedRoute(document: Record<string, unknown> | null) {
  const userData = await mkdtemp(path.join(os.tmpdir(), 'window-route-'))
  const database = migratedDatabase()
  insertProject(database, 'project-1')
  insertSession(database, { id: SESSION, projectId: 'project-1' })
  insertSession(database, { id: OTHER_PROJECT_SESSION, projectId: 'project-3' })
  if (document !== null) await writeDocument(windowRoutePath(userData), document)
  try {
    return await readWindowRoute(userData, database)
  } finally {
    database.$client.close()
    await rm(userData, { recursive: true, force: true })
  }
}

test('reopens the saved Session List, Session or draft of a listed Project', async () => {
  for (const route of [
    `/projects/project-1/sessions/${SESSION}?status=all`,
    '/projects/project-1/sessions',
    '/projects/project-1/sessions/new',
  ])
    assert.equal(await savedRoute({ route }), route)
})

test('opens the Session List when the saved Session is not in that Project', async () => {
  for (const sessionId of [OTHER_PROJECT_SESSION, '00000000-0000-4000-8000-000000000009'])
    assert.equal(
      await savedRoute({ route: `/projects/project-1/sessions/${sessionId}?status=all` }),
      '/projects/project-1/sessions?status=all',
    )
})

test('opens the default route for a missing, foreign or malformed saved route', async () => {
  assert.equal(await savedRoute(null), undefined)
  assert.equal(await savedRoute({ route: '/projects/project-2/sessions/one' }), undefined)
  assert.equal(await savedRoute({ route: '/projects/project-1/tickets/ARGO-1' }), undefined)
  assert.equal(await savedRoute({ route: 42 }), undefined)
})

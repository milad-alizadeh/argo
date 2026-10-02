import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'vitest'
import { insertProject, migratedDatabase } from '@/mocks/database/migrated-database'
import { portablePath, writeDocument } from '../storage/portable-file'
import { readWindowRoute } from './window-route'

async function savedRoute(document: Record<string, unknown> | null) {
  const userData = await mkdtemp(path.join(os.tmpdir(), 'window-route-'))
  const database = migratedDatabase()
  insertProject(database, 'project-1')
  if (document !== null) await writeDocument(portablePath(userData, 'window-route.json'), document)
  try {
    return await readWindowRoute(userData, database)
  } finally {
    database.$client.close()
    await rm(userData, { recursive: true, force: true })
  }
}

test('reopens a saved Sessions route of a listed Project', async () => {
  const route = '/projects/project-1/sessions/00000000-0000-4000-8000-000000000001?status=all'
  assert.equal(await savedRoute({ route }), route)
  assert.equal(
    await savedRoute({ route: '/projects/project-1/sessions' }),
    '/projects/project-1/sessions',
  )
})

test('opens the default route for a missing, foreign or malformed saved route', async () => {
  assert.equal(await savedRoute(null), undefined)
  assert.equal(await savedRoute({ route: '/projects/project-2/sessions/one' }), undefined)
  assert.equal(await savedRoute({ route: '/projects/project-1/tickets/ARGO-1' }), undefined)
  assert.equal(await savedRoute({ route: '/projects/project-1/sessions/optimistic:1' }), undefined)
  assert.equal(await savedRoute({ route: 42 }), undefined)
})

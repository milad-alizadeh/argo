import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { createDurableDatabase } from '@/platform/main/storage/durable-database'
import { databaseMigrationsFolder } from '@/platform/main/storage/migrations-folder'
import { openSharedDatabase } from '@/platform/main/storage/shared-database'
import { createSessionTicketLinkStoreFromDatabase } from './session-links'

const roots: string[] = []
const migrationsFolder = databaseMigrationsFolder()

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

test('keeps an asserted Session to Ticket link after the shared database reopens', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-session-links-sqlite-'))
  roots.push(root)
  const first = openSharedDatabase(root, migrationsFolder)
  const links = createSessionTicketLinkStoreFromDatabase(createDurableDatabase(first))
  await links.connect(
    'session-1',
    { projectId: 'project-1', key: '#607', title: 'Ticket #607', state: 'open' },
    '2026-09-14T00:00:00.000Z',
  )
  links.close()

  const reopened = createSessionTicketLinkStoreFromDatabase(
    createDurableDatabase(openSharedDatabase(root, migrationsFolder)),
  )
  await expect(reopened.linkFor('session-1')).resolves.toEqual({
    projectId: 'project-1',
    key: '#607',
    title: 'Ticket #607',
    state: 'open',
    createdAt: '2026-09-14T00:00:00.000Z',
  })
  reopened.close()
})

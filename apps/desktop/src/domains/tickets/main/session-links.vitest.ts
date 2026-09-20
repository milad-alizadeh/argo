import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, expect, test } from 'vitest'
import { createSQLiteSessionTicketLinkStore } from '@/domains/tickets/main/session-links'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

test('keeps an asserted Session to Ticket link after the shared database reopens', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-session-links-sqlite-'))
  roots.push(root)
  const databasePath = path.join(root, 'argo.sqlite')
  const first = new DatabaseSync(databasePath)
  const links = createSQLiteSessionTicketLinkStore(first)
  await links.connect(
    'session-1',
    { projectId: 'project-1', key: '#607', title: 'Ticket #607', state: 'open' },
    '2026-09-14T00:00:00.000Z',
  )
  links.close()

  const reopened = createSQLiteSessionTicketLinkStore(new DatabaseSync(databasePath))
  await expect(reopened.linkFor('session-1')).resolves.toEqual({
    projectId: 'project-1',
    key: '#607',
    title: 'Ticket #607',
    state: 'open',
    createdAt: '2026-09-14T00:00:00.000Z',
  })
  reopened.close()
})

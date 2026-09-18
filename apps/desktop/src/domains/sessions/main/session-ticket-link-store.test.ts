import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { type TestContext, test } from 'node:test'
import { createSessionTicketLinkStore } from './session-ticket-link-store'

async function store(context: TestContext) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-session-links-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  return createSessionTicketLinkStore(path.join(root, 'portable-v1', 'session-tickets.json'))
}

const ticket = (key: string) => ({
  projectId: 'project-1',
  key,
  title: `Ticket ${key}`,
  state: 'open' as const,
})

test('a Session that was never linked reads no Ticket', async (context) => {
  const links = await store(context)
  assert.equal(await links.linkFor('session-1'), null)
})

test('connecting a Ticket makes it read back with its createdAt', async (context) => {
  const links = await store(context)
  await links.connect('session-1', ticket('#607'), '2026-09-14T00:00:00.000Z')
  assert.deepEqual(await links.linkFor('session-1'), {
    ...ticket('#607'),
    createdAt: '2026-09-14T00:00:00.000Z',
  })
})

test('connecting a second Ticket to the same Session replaces the first', async (context) => {
  const links = await store(context)
  await links.connect('session-1', ticket('#607'), '2026-09-14T00:00:00.000Z')
  await links.connect('session-1', ticket('#608'), '2026-09-14T00:01:00.000Z')
  assert.deepEqual(await links.linkFor('session-1'), {
    ...ticket('#608'),
    createdAt: '2026-09-14T00:01:00.000Z',
  })
})

test('disconnecting drops the link and leaves other Sessions alone', async (context) => {
  const links = await store(context)
  await links.connect('session-1', ticket('#607'), '2026-09-14T00:00:00.000Z')
  await links.connect('session-2', ticket('#607'), '2026-09-14T00:01:00.000Z')
  await links.disconnect('session-1')
  assert.equal(await links.linkFor('session-1'), null)
  assert.notEqual(await links.linkFor('session-2'), null)
})

test('linkedSessions lists every Session on one Ticket, most recently linked first', async (context) => {
  const links = await store(context)
  await links.connect('session-1', ticket('#607'), '2026-09-14T00:00:00.000Z')
  await links.connect('session-2', ticket('#607'), '2026-09-14T00:02:00.000Z')
  await links.connect('session-3', ticket('#608'), '2026-09-14T00:01:00.000Z')
  assert.deepEqual(await links.linkedSessions('project-1', '#607'), ['session-2', 'session-1'])
})

test('a link is scoped to its Project: the same key in another Project is a different Ticket', async (context) => {
  const links = await store(context)
  await links.connect('session-1', ticket('#607'), '2026-09-14T00:00:00.000Z')
  await links.connect(
    'session-2',
    { ...ticket('#607'), projectId: 'project-2' },
    '2026-09-14T00:01:00.000Z',
  )
  assert.deepEqual(await links.linkedSessions('project-1', '#607'), ['session-1'])
})

import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { createSessionArchiveStore } from './archive-store'

async function storePath(context: { after: (work: () => Promise<unknown>) => void }) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-archive-store-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  return path.join(root, 'portable-v1', 'session-archive.json')
}

test('names no archived Session before anything has been archived', async (context) => {
  const store = createSessionArchiveStore(await storePath(context))

  assert.deepEqual([...(await store.archivedIds())], [])
})

test('archives a Session Argo has never seen before', async (context) => {
  const file = await storePath(context)
  const store = createSessionArchiveStore(file)

  await store.setArchived(['never-discovered'], true)

  assert.deepEqual([...(await store.archivedIds())], ['never-discovered'])
  assert.ok(JSON.parse(await readFile(file, 'utf8'))['never-discovered'].archivedAt)
})

test('restores every id a Session has answered to', async (context) => {
  const store = createSessionArchiveStore(await storePath(context))
  await store.setArchived(['root-id'], true)

  await store.setArchived(['root-id', 'resumed-id'], false)

  assert.deepEqual([...(await store.archivedIds())], [])
})

test('keeps the Sessions a concurrent archive already recorded', async (context) => {
  const store = createSessionArchiveStore(await storePath(context))

  await Promise.all([store.setArchived(['first'], true), store.setArchived(['second'], true)])

  assert.deepEqual([...(await store.archivedIds())].sort(), ['first', 'second'])
})

test('reads no archived Session from a document it cannot parse', async (context) => {
  const file = await storePath(context)
  const store = createSessionArchiveStore(file)
  await store.setArchived(['first'], true)
  await writeFile(file, 'not json at all')

  assert.deepEqual([...(await store.archivedIds())], [])
})

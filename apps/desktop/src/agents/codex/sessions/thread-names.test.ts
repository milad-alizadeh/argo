import { Database } from 'bun:sqlite'
import assert from 'node:assert/strict'
import { mkdtemp, rm, utimes } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { readThreadNames } from '@/agents/codex/sessions/thread-names'

type Context = { after: (cleanup: () => Promise<void>) => void }

// Whole seconds, so setting it again leaves the store's modification time exactly as it was.
const HELD_TIME = 1_789_000_000

// A state store with Codex's own writer connection held open, as Codex Desktop holds it.
async function stateStore(context: Context, journalMode: 'DELETE' | 'WAL') {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-state-'))
  const file = path.join(directory, 'state_5.sqlite')
  const writer = new Database(file, { create: true })
  context.after(async () => {
    writer.close()
    await rm(directory, { recursive: true, force: true })
  })
  writer.run(`PRAGMA journal_mode = ${journalMode}`)
  writer.run('CREATE TABLE threads (id TEXT PRIMARY KEY, title TEXT, name TEXT)')
  return {
    writer,
    name: (id: string, name: string | null) =>
      writer.run('INSERT OR REPLACE INTO threads (id, name) VALUES (?, ?)', [id, name]),
    holdTime: (seconds = HELD_TIME) => utimes(file, seconds, seconds),
    names: readThreadNames(file, (store) => new Database(store, { readonly: true })),
  }
}

test('keeps a name it has read until the state store changes', async (context) => {
  const store = await stateStore(context, 'DELETE')
  store.name('thread-a', 'First name')
  await store.holdTime()
  assert.deepEqual(store.names(['thread-a']), new Map([['thread-a', 'First name']]))

  store.name('thread-a', 'Other name')
  await store.holdTime()
  assert.deepEqual(store.names(['thread-a']), new Map([['thread-a', 'First name']]))

  await store.holdTime(HELD_TIME + 60)
  assert.deepEqual(store.names(['thread-a']), new Map([['thread-a', 'Other name']]))
})

test('asks an unchanged state store only about threads it has not answered', async (context) => {
  const store = await stateStore(context, 'DELETE')
  store.name('thread-a', 'First name')
  store.name('thread-b', 'Second name')
  await store.holdTime()
  store.names(['thread-a'])

  store.name('thread-a', 'Other name')
  await store.holdTime()
  assert.deepEqual(
    store.names(['thread-a', 'thread-b']),
    new Map([
      ['thread-a', 'First name'],
      ['thread-b', 'Second name'],
    ]),
  )
})

test('reads a name Codex committed to the write-ahead log', async (context) => {
  const store = await stateStore(context, 'WAL')
  store.name('thread-a', null)
  await store.holdTime()
  assert.deepEqual(store.names(['thread-a']), new Map())

  store.name('thread-a', 'Named later')
  await store.holdTime()
  assert.deepEqual(store.names(['thread-a']), new Map([['thread-a', 'Named later']]))
})

test('asks again once a lock lifts, even when nothing was written', async (context) => {
  const store = await stateStore(context, 'DELETE')
  store.name('thread-a', 'First name')
  store.writer.run('BEGIN EXCLUSIVE')
  assert.deepEqual(store.names(['thread-a']), new Map())

  store.writer.run('ROLLBACK')
  assert.deepEqual(store.names(['thread-a']), new Map([['thread-a', 'First name']]))
})

test('keeps the names it has while a changed state store is locked', async (context) => {
  const store = await stateStore(context, 'DELETE')
  store.name('thread-a', 'First name')
  await store.holdTime()
  store.names(['thread-a'])

  store.name('thread-a', 'Other name')
  await store.holdTime(HELD_TIME + 60)
  store.writer.run('BEGIN EXCLUSIVE')
  assert.deepEqual(store.names(['thread-a']), new Map([['thread-a', 'First name']]))

  store.writer.run('ROLLBACK')
  assert.deepEqual(store.names(['thread-a']), new Map([['thread-a', 'Other name']]))
})

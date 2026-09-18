// The SQLite Session index, driven directly: what it answers for what was written to it, never
// which statement ran. Recovering a damaged or outdated index is `store-recovery.vitest.ts`.
import { afterEach, expect, test } from 'vitest'
import { chainOf, fileFor, passOf, rowFor, storeHarness, writeChain } from './store-fixtures'

const stores = storeHarness()
afterEach(stores.cleanUp)

test('answers a chain with the Roster projection that was written for it', async () => {
  const { store } = await stores.open()
  const row = rowFor('one', '2026-09-17T10:00:00.000Z')

  writeChain(store, row, { links: [{ sessionId: 'one', parentSessionId: null }] })

  expect(store.rowsOfChains('claude', ['one'])).toEqual([row])
})

test('keeps one CLI’s rows out of another CLI’s answers', async () => {
  const { store } = await stores.open()
  const claude = rowFor('shared', '2026-09-17T10:00:00.000Z')

  writeChain(store, claude)

  expect(store.rowsOfChains('codex', ['shared'])).toEqual([])
  expect(store.filesAt('codex', ['/transcripts/shared.jsonl'])).toEqual([])
})

test('reports the identity it holds for a path, so a caller can tell a changed file from an unchanged one', async () => {
  const { store } = await stores.open()
  store.write('claude', passOf({ files: [fileFor('one')] }))

  expect(store.filesAt('claude', ['/transcripts/one.jsonl', '/transcripts/absent.jsonl'])).toEqual([
    { path: '/transcripts/one.jsonl', sessionId: 'one', writtenAt: 10, size: 20, chainId: 'one' },
  ])
})

test('replaces a chain’s files, so a re-stitch that moved a file leaves nothing behind', async () => {
  const { store } = await stores.open()
  const first = rowFor('origin', '2026-09-17T10:00:00.000Z')
  store.write(
    'claude',
    passOf({
      files: [fileFor('origin'), fileFor('resumed', 'origin')],
      chains: [chainOf(first)],
      links: [{ sessionId: 'resumed', parentSessionId: 'origin' }],
    }),
  )

  const split = rowFor('origin', '2026-09-17T11:00:00.000Z')
  store.write(
    'claude',
    passOf({
      files: [fileFor('origin')],
      chains: [chainOf(split)],
      links: [{ sessionId: 'origin', parentSessionId: null }],
    }),
  )

  expect(store.filesOfChains('claude', ['origin']).map((file) => file.sessionId)).toEqual([
    'origin',
  ])
  expect(store.rowsOfChains('claude', ['origin'])).toEqual([split])
})

test('forgets a file the pass found gone from disk', async () => {
  const { store } = await stores.open()
  store.write('claude', passOf({ files: [fileFor('one'), fileFor('two')] }))

  store.write('claude', passOf({ removedPaths: ['/transcripts/two.jsonl'] }))

  expect(store.filesAt('claude', ['/transcripts/one.jsonl', '/transcripts/two.jsonl'])).toEqual([
    { path: '/transcripts/one.jsonl', sessionId: 'one', writtenAt: 10, size: 20, chainId: 'one' },
  ])
})

test('answers every resume link it holds, so a chain keeps its id across a restart', async () => {
  const { store, databasePath } = await stores.open()
  store.write(
    'claude',
    passOf({
      files: [fileFor('origin'), fileFor('resumed', 'origin')],
      links: [
        { sessionId: 'origin', parentSessionId: null },
        { sessionId: 'resumed', parentSessionId: 'origin' },
      ],
    }),
  )
  store.close()

  expect(stores.reopen(databasePath).chainLinks('claude')).toEqual([
    { sessionId: 'origin', parentSessionId: null },
    { sessionId: 'resumed', parentSessionId: 'origin' },
  ])
})

test('answers nothing for an empty list of chains rather than everything it holds', async () => {
  const { store } = await stores.open()
  writeChain(store, rowFor('one', '2026-09-17T10:00:00.000Z'))

  expect(store.rowsOfChains('claude', [])).toEqual([])
  expect(store.filesOfChains('claude', [])).toEqual([])
  expect(store.filesAt('claude', [])).toEqual([])
})

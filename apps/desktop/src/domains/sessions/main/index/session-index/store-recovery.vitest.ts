// The index holds no fact the transcripts do not, so every way it can be unusable ends the same:
// start again from empty and let the next pass rebuild it (#2372).
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, expect, test } from 'vitest'
import { chainOf, passOf, rowFor, storeHarness, writeChain } from './store-fixtures'

const stores = storeHarness()
afterEach(stores.cleanUp)

test('treats a row that no longer parses as a cache miss rather than answering with it', async () => {
  const { store } = await stores.open()
  const row = rowFor('one', '2026-09-17T10:00:00.000Z')
  store.write(
    'claude',
    passOf({
      chains: [
        chainOf(row),
        // A row written by a version whose schema had a field this one does not know.
        {
          chainId: 'two',
          updatedAt: row.updatedAt,
          row: { nonsense: true } as never,
          originUnread: false,
          searchText: '',
        },
      ],
    }),
  )

  expect(store.rowsOfChains('claude', ['one', 'two'])).toEqual([row])
})

test('does not let a malformed cached row break an indexed search', async () => {
  const { store } = await stores.open()
  const row = {
    ...rowFor('one', '2026-09-17T10:00:00.000Z'),
    title: { text: 'Search me', source: 'custom' as const },
  }
  store.write('claude', passOf({ chains: [chainOf(row)] }))
  store.write(
    'claude',
    passOf({
      chains: [
        {
          chainId: 'broken',
          updatedAt: row.updatedAt,
          row: { nonsense: true } as never,
          originUnread: false,
          searchText: 'Search me too',
        },
      ],
    }),
  )

  expect(store.searchChains('claude', 'search')).toEqual([row])
})

test('starts an index written by an unknown schema version again from empty', async () => {
  const { store, databasePath } = await stores.open()
  writeChain(store, rowFor('one', '2026-09-17T10:00:00.000Z'))
  store.close()
  const aged = new DatabaseSync(databasePath)
  aged.exec('PRAGMA user_version = 9999')
  aged.close()

  const reopened = stores.reopen(databasePath)
  expect(reopened.rowsOfChains('claude', ['one'])).toEqual([])
  expect(reopened.filesAt('claude', ['/transcripts/one.jsonl'])).toEqual([])
})

test('starts an unreadable index file again from empty', async () => {
  const databasePath = path.join(await stores.folder(), 'sessions.sqlite')
  await writeFile(databasePath, 'this is not a database', 'utf8')

  const store = stores.reopen(databasePath)
  const row = rowFor('one', '2026-09-17T10:00:00.000Z')
  writeChain(store, row, { files: [] })

  expect(store.rowsOfChains('claude', ['one'])).toEqual([row])
})

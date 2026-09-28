import type { Dispatch, SetStateAction } from 'react'
import { expect, test } from 'vitest'
import type { SessionFeed, SessionFeedPage } from '../types'
import {
  feedChainKey,
  loadOlderFeedPage,
  type OlderPagesByChain,
  touchOlderFeedChain,
} from './feed-history-pages'
import { mergedContent } from './use-feed-history'

const sessionAKey = feedChainKey('session-a', null)
const sessionBKey = feedChainKey('session-b', null)
function stateSetter(state: {
  current: OlderPagesByChain
}): Dispatch<SetStateAction<OlderPagesByChain>> {
  return (update) => {
    state.current = typeof update === 'function' ? update(state.current) : update
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((complete) => {
    resolve = complete
  })
  return { promise, resolve }
}

function loadPage(
  state: { current: OlderPagesByChain },
  options: Pick<Parameters<typeof loadOlderFeedPage>[0], 'sessionId' | 'cursor' | 'readPage'> &
    Partial<Pick<Parameters<typeof loadOlderFeedPage>[0], 'subagentId' | 'refreshLatest'>>,
  loadingKeys = new Set<string>(),
) {
  return loadOlderFeedPage({
    subagentId: null,
    refreshLatest: async () => null,
    loadingKeys,
    setOlderByChain: stateSetter(state),
    ...options,
  })
}

function page(ids: string[], revision: string): SessionFeed {
  return {
    version: 1,
    type: 'session.feed.read',
    requestId: revision,
    sessionId: 'session-1',
    chainId: 'session-1',
    revision,
    content: ids.map((id) => ({ kind: 'message', id, role: 'assistant', text: id })),
    rows: [],
  }
}

function olderPageState({
  ids,
  revision,
  cursor,
  loading = false,
}: {
  ids: string[]
  revision: string
  cursor: string
  loading?: boolean
}) {
  return { pages: [page(ids, revision)], cursor, loading, failed: false }
}

test('a refreshed newest page replaces overlap without duplicating older rows', () => {
  const older = page(['one', 'two', 'three'], 'older')
  const newest = page(['three', 'four', 'five'], 'newest')
  expect(mergedContent([older], newest).map((item) => item.id)).toEqual([
    'one',
    'two',
    'three',
    'four',
    'five',
  ])
})

test('a refreshed newest page keeps content from every loaded older page', () => {
  const oldest = page(['one', 'two', 'three'], 'oldest')
  const middle = page(['three', 'four'], 'middle')
  const newest = page(['four', 'five'], 'newest')

  expect(mergedContent([oldest, middle], newest).map((item) => item.id)).toEqual([
    'one',
    'two',
    'three',
    'four',
    'five',
  ])
  expect(mergedContent([oldest, middle], newest)[3]).toMatchObject({ id: 'four', text: 'four' })
})

test('a late Session A page success keeps Session B history intact', async () => {
  const sessionBPages = {
    pages: [page(['b-one', 'b-two'], 'session-b')],
    cursor: 'b-cursor',
    loading: false,
    failed: false,
  }
  const state = { current: { [sessionBKey]: sessionBPages } as OlderPagesByChain }
  const loadingKeys = new Set<string>()
  const pendingA = deferred<SessionFeedPage>()
  const loadA = loadPage(
    state,
    {
      sessionId: 'session-a',
      cursor: 'a-cursor',
      readPage: () => pendingA.promise,
    },
    loadingKeys,
  )

  await loadPage(
    state,
    {
      sessionId: 'session-b',
      cursor: 'b-cursor',
      readPage: async () => page(['b-one', 'b-two'], 'session-b-next'),
    },
    loadingKeys,
  )
  const loadedBPages = state.current[sessionBKey]
  pendingA.resolve(page(['a-one'], 'session-a'))
  await loadA

  expect(state.current[sessionBKey]).toBe(loadedBPages)
  expect(state.current[sessionBKey]?.pages[0]?.content.map((item) => item.id)).toEqual([
    'b-one',
    'b-two',
  ])
  expect(state.current[sessionAKey]?.pages[0]?.content[0]?.id).toBe('a-one')
})

test('a pending older cursor is requested only once per Session', async () => {
  const pending = deferred<SessionFeedPage>()
  const loadingKeys = new Set<string>()
  let calls = 0
  const readPage = async () => {
    calls += 1
    return pending.promise
  }

  const state = { current: {} as OlderPagesByChain }
  const firstRequest = loadPage(
    state,
    {
      sessionId: 'session-a',
      cursor: 'a-cursor',
      readPage,
    },
    loadingKeys,
  )
  await loadPage(
    state,
    {
      sessionId: 'session-a',
      cursor: 'a-cursor',
      readPage,
    },
    loadingKeys,
  )

  expect(calls).toBe(1)
  pending.resolve(page(['a-one'], 'a-page'))
  await firstRequest
  expect(calls).toBe(1)
})

test('retains at most five history chains and keeps recently used chains', async () => {
  const state = { current: {} as OlderPagesByChain }
  for (const sessionId of ['session-a', 'session-b', 'session-c', 'session-d', 'session-e']) {
    await loadPage(state, {
      sessionId,
      cursor: `${sessionId}-cursor`,
      readPage: async () => page([`${sessionId}-item`], sessionId),
    })
  }

  state.current = touchOlderFeedChain(state.current, sessionAKey)
  await loadPage(state, {
    sessionId: 'session-f',
    cursor: 'session-f-cursor',
    readPage: async () => page(['session-f-item'], 'session-f'),
  })

  expect(Object.keys(state.current)).toHaveLength(5)
  expect(state.current[sessionAKey]).toBeDefined()
  expect(state.current[feedChainKey('session-b', null)]).toBeUndefined()
  expect(state.current[feedChainKey('session-f', null)]).toBeDefined()
})

test('a Session A page failure keeps Session B history intact', async () => {
  const sessionBPages = olderPageState({
    ids: ['b-one'],
    revision: 'session-b',
    cursor: 'b-cursor',
  })
  const sessionAPages = olderPageState({
    ids: ['a-one'],
    revision: 'session-a',
    cursor: 'a-cursor',
    loading: true,
  })
  const state = { current: { [sessionAKey]: sessionAPages, [sessionBKey]: sessionBPages } }

  await loadPage(state, {
    sessionId: 'session-a',
    cursor: 'a-cursor',
    readPage: async () => {
      throw new Error('read failed')
    },
  })

  expect(state.current[sessionAKey]).toMatchObject({ cursor: 'a-cursor', failed: true })
  expect(state.current[sessionBKey]).toBe(sessionBPages)
})

for (const { name, refreshLatest, expected } of [
  {
    name: 'discards loaded pages and adopts the refreshed cursor',
    refreshLatest: async () => ({
      ...page(['a-two'], 'refreshed'),
      olderCursor: 'refreshed-cursor',
    }),
    expected: { cursor: 'refreshed-cursor', loading: false, failed: false },
  },
  {
    name: 'clears loading and reports a failed refresh',
    refreshLatest: async () => {
      throw new Error('refresh failed')
    },
    expected: { cursor: 'expired-cursor', loading: false, failed: true },
  },
]) {
  test(`an expired Session A cursor ${name}`, async () => {
    const sessionBPages = olderPageState({
      ids: ['b-one'],
      revision: 'session-b',
      cursor: 'b-cursor',
    })
    const sessionAPages = olderPageState({
      ids: ['a-one'],
      revision: 'session-a',
      cursor: 'expired-cursor',
      loading: true,
    })
    const state = { current: { [sessionAKey]: sessionAPages, [sessionBKey]: sessionBPages } }

    await loadPage(state, {
      sessionId: 'session-a',
      cursor: 'expired-cursor',
      refreshLatest,
      readPage: async () => {
        throw new Error('expired-feed-cursor')
      },
    })

    expect(state.current[sessionAKey]).toMatchObject({
      ...expected,
      pages: [],
    })
    expect(state.current[sessionBKey]).toBe(sessionBPages)
  })
}

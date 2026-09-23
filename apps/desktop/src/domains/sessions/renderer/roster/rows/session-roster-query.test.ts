import { type InfiniteData, InfiniteQueryObserver, QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { sessionRosterQuery } from './session-roster-query'

const originalWindow = globalThis.window

type RosterObserver = {
  fetchNextPage: () => Promise<unknown>
  getCurrentResult: () => { data: InfiniteData<ReturnType<typeof listedReply>> | undefined }
  refetch: () => Promise<unknown>
}

function listedReply(requestId: string, title: string, nextCursor: string | null = null) {
  return {
    version: 1,
    type: 'session.listed',
    requestId,
    sessions: [
      {
        id: 'session-a',
        retiredIds: [],
        title: { text: title, source: 'transcript' },
      },
    ],
    filesFound: 1,
    filesRead: 1,
    filesUnreadable: 0,
    filesParsed: 0,
    nextCursor,
    historyComplete: true,
    partialFailures: [],
  }
}

function withListSessions(...replies: ReturnType<typeof listedReply>[]) {
  const listSessions = vi.fn()
  for (const reply of replies) listSessions.mockResolvedValueOnce(reply)
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { argo: { listSessions } },
  })
  return listSessions
}

afterEach(() => {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow })
})

async function observeRoster(read: (observer: RosterObserver) => Promise<void>) {
  const client = new QueryClient()
  const options = sessionRosterQuery(true, { projectRoot: null })
  const observer = new InfiniteQueryObserver(client, options)
  const unsubscribe = observer.subscribe(() => {})
  await read(observer)
  unsubscribe()
  return { client, options }
}

// Reads twice and hands back the roster each read published.
async function readTwice(secondTitle: string) {
  withListSessions(listedReply('request-1', 'Read the Feed'), listedReply('request-2', secondTitle))
  let first: unknown
  let second: unknown
  await observeRoster(async (observer) => {
    await observer.refetch()
    first = observer.getCurrentResult().data
    await observer.refetch()
    second = observer.getCurrentResult().data
  })

  return { first, second }
}

describe('caching the Session roster read by its stable identity', () => {
  test('never reads the roster on a timer', () => {
    const options = sessionRosterQuery(true, { projectRoot: null })

    expect(options.refetchInterval).toBeUndefined()
  })

  test('keeps the roster it already published when a read finds the same Sessions', async () => {
    const { first, second } = await readTwice('Read the Feed')

    expect(second).toBe(first)
  })

  test('publishes a new roster when a Session changes', async () => {
    const { first, second } = await readTwice('Fix the Feed')

    expect(second).not.toBe(first)
    expect(second?.pages[0]?.sessions[0]?.title.text).toBe('Fix the Feed')
  })

  test('keeps every loaded page under one Roster identity', () => {
    const cold = sessionRosterQuery(true, { projectRoot: null })
    const grown = sessionRosterQuery(true, { projectRoot: null })

    expect(grown.queryKey).toEqual(cold.queryKey)
  })

  test('adds the page the backend cursor resolves', async () => {
    withListSessions(
      listedReply('request-1', 'Read the Feed', 'next-page'),
      listedReply('request-2', 'Fix the Feed'),
    )
    let pages: readonly string[] = []
    await observeRoster(async (observer) => {
      await observer.refetch()
      await observer.fetchNextPage()
      pages = observer
        .getCurrentResult()
        .data?.pages.flatMap((page) => page.sessions.map((session) => session.title?.text ?? '')) ?? []
    })

    expect(pages).toEqual(['Read the Feed', 'Fix the Feed'])
  })
})

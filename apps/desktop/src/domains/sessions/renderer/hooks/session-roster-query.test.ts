import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { sessionRosterQuery } from '@/domains/sessions/renderer/hooks/session-roster-query'

const originalWindow = globalThis.window

function listedReply(requestId: string, title: string) {
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

// Reads twice and hands back the roster each read published.
async function readTwice(secondTitle: string) {
  withListSessions(listedReply('request-1', 'Read the Feed'), listedReply('request-2', secondTitle))
  const client = new QueryClient()
  const options = sessionRosterQuery(true, { projectRoot: null, cursor: null })
  const observer = new QueryObserver(client, options)
  const unsubscribe = observer.subscribe(() => {})

  await observer.refetch()
  const first = client.getQueryData(options.queryKey)
  await observer.refetch()
  const second = client.getQueryData(options.queryKey)
  unsubscribe()

  return { first, second }
}

describe('caching the Session roster read by its stable identity', () => {
  test('never reads the roster on a timer', () => {
    const options = sessionRosterQuery(true, { projectRoot: null, cursor: null })

    expect(options.refetchInterval).toBeUndefined()
  })

  test('keeps the roster it already published when a read finds the same Sessions', async () => {
    const { first, second } = await readTwice('Read the Feed')

    expect(second).toBe(first)
  })

  test('publishes a new roster when a Session changes', async () => {
    const { first, second } = await readTwice('Fix the Feed')

    expect(second).not.toBe(first)
    expect(second?.sessions[0]?.title.text).toBe('Fix the Feed')
  })

  // Three hooks read the roster and all of them resolved to one key, so a read still carrying the
  // cold cursor republished the first page over the wider window the reader had scrolled open and
  // the loaded rows disappeared. Two windows are two reads, so they cache apart.
  test('caches a grown window apart from the window it grew from', () => {
    const cold = sessionRosterQuery(true, { projectRoot: null, cursor: null })
    const grown = sessionRosterQuery(true, { projectRoot: null, cursor: '100' })

    expect(grown.queryKey).not.toEqual(cold.queryKey)
  })

  test('asks for the window the cursor names rather than the one the last render held', async () => {
    const listSessions = withListSessions(listedReply('request-1', 'Read the Feed'))
    const client = new QueryClient()
    const options = sessionRosterQuery(true, { projectRoot: null, cursor: '100' })
    const observer = new QueryObserver(client, options)
    const unsubscribe = observer.subscribe(() => {})

    await observer.refetch()
    unsubscribe()

    expect(listSessions).toHaveBeenCalledWith({ projectRoot: null, cursor: '100' })
  })
})

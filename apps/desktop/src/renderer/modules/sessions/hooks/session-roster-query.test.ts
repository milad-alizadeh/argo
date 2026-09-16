import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { sessionRosterQuery } from './session-roster-query'

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

// Polls twice and hands back the roster each poll published.
async function pollTwice(secondTitle: string) {
  withListSessions(listedReply('request-1', 'Read the Feed'), listedReply('request-2', secondTitle))
  const client = new QueryClient()
  const options = sessionRosterQuery('session-a', true, null)
  const observer = new QueryObserver(client, options)
  const unsubscribe = observer.subscribe(() => {})

  await observer.refetch()
  const first = client.getQueryData(options.queryKey)
  await observer.refetch()
  const second = client.getQueryData(options.queryKey)
  unsubscribe()

  return { first, second }
}

describe('sessionRosterQuery', () => {
  test('does not poll while an optimistic Session is selected', () => {
    const options = sessionRosterQuery('optimistic:new-session', true, null)

    expect(options.refetchInterval).toBe(false)
  })

  test('keeps the roster it already published when a poll finds the same Sessions', async () => {
    const { first, second } = await pollTwice('Read the Feed')

    expect(second).toBe(first)
  })

  test('publishes a new roster when a Session changes', async () => {
    const { first, second } = await pollTwice('Fix the Feed')

    expect(second).not.toBe(first)
    expect(second?.sessions[0]?.title.text).toBe('Fix the Feed')
  })
})

import { describe, expect, test } from 'bun:test'
import { QueryClient } from '@tanstack/react-query'
import { DEFAULT_HARNESS, HARNESSES } from '@/harnesses/harness'
import { trpc } from '@/platform/renderer/trpc-client'
import {
  listedSessionHarness,
  readListedSessionHarness,
  subscribeToSessionLists,
} from './listed-session-harness'
import { sessionListQueryKey } from './session-list-query'

// The default is the first Harness, so the second shows a row's own Harness won.
const listed = HARNESSES[1]
const page = (rows: { id: string; harness: string }[]) => ({ pages: [{ rows }] })
const listInput = { projectId: 'project', filter: 'active', search: '' } as const
// A batched notice lands on the next tick.
const settled = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('listedSessionHarness', () => {
  test('a loaded row names its Session Harness', () => {
    const lists = [
      undefined,
      page([{ id: 'other', harness: DEFAULT_HARNESS }]),
      page([{ id: 'opened', harness: listed }]),
    ]
    expect(listedSessionHarness(lists, 'opened')).toBe(listed)
  })

  test('no loaded row, or an unknown Harness, names none', () => {
    expect(listedSessionHarness([page([{ id: 'other', harness: listed }])], 'opened')).toBeNull()
    expect(
      listedSessionHarness([page([{ id: 'opened', harness: 'retired' }])], 'opened'),
    ).toBeNull()
  })
})

describe('the Session list cache', () => {
  test('a list that loads after the Session opened names its Harness and tells the reader', async () => {
    const queryClient = new QueryClient()
    let changes = 0
    const stop = subscribeToSessionLists(queryClient, () => changes++)
    try {
      expect(readListedSessionHarness(queryClient, 'opened')).toBeNull()
      queryClient.setQueryData(
        sessionListQueryKey(listInput),
        page([{ id: 'opened', harness: listed }]),
      )
      await settled()
      expect(changes).toBeGreaterThan(0)
      expect(readListedSessionHarness(queryClient, 'opened')).toBe(listed)
    } finally {
      stop()
    }
  })

  test('another query does not tell the reader', async () => {
    const queryClient = new QueryClient()
    let changes = 0
    const stop = subscribeToSessionLists(queryClient, () => changes++)
    try {
      queryClient.setQueryData(
        trpc.sessionDetails.queryKey({ sessionId: 'opened' }),
        page([{ id: 'opened', harness: listed }]) as never,
      )
      await settled()
      expect(changes).toBe(0)
      expect(readListedSessionHarness(queryClient, 'opened')).toBeNull()
    } finally {
      stop()
    }
  })
})

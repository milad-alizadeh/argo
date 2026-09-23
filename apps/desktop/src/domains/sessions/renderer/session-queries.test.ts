import { describe, expect, test } from 'bun:test'
import { QueryClient } from '@tanstack/react-query'
import { rosterRow } from '@/domains/sessions/contract/observation/roster-row-test-fixture'
import { invalidateSessionRoster, markSessionRead, sessionRosterQueryKey } from './session-queries'

describe('the Session roster queries', () => {
  test('coalesces one watch event into one roster invalidation', async () => {
    const queryClient = new QueryClient()
    let invalidations = 0
    queryClient.invalidateQueries = async (filters) => {
      expect(filters).toEqual({ queryKey: sessionRosterQueryKey })
      invalidations += 1
    }

    const first = invalidateSessionRoster(queryClient)
    const second = invalidateSessionRoster(queryClient)
    await Promise.all([first, second])

    expect(invalidations).toBe(1)
  })

  test('opening a Session clears unread state without dropping a loaded row', () => {
    const queryClient = new QueryClient()
    const session = rosterRow({ id: 'resumed', retiredIds: ['retired'], unread: true })
    queryClient.setQueryData([...sessionRosterQueryKey, null], {
      pages: [
        {
          sessions: [session],
          filesFound: 1,
          filesRead: 1,
          filesUnreadable: 0,
          filesParsed: 1,
          nextCursor: null,
          historyComplete: true,
          partialFailures: [],
        },
      ],
      pageParams: [null],
    })

    markSessionRead(queryClient, 'resumed', ['retired'])

    const roster = queryClient.getQueryData<{ pages: { sessions: (typeof session)[] }[] }>([
      ...sessionRosterQueryKey,
      null,
    ])
    expect(roster?.pages[0]?.sessions).toHaveLength(1)
    expect(roster?.pages[0]?.sessions[0]?.unread).toBe(false)
  })
})

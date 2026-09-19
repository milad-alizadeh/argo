import { describe, expect, test } from 'bun:test'
import { QueryClient } from '@tanstack/react-query'
import { invalidateSessionRoster, sessionRosterQueryKey } from './session-queries'

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
})

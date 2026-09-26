import type { InfiniteData, UseInfiniteQueryOptions } from '@tanstack/react-query'
import { sessionError } from '@/domains/sessions/api/session-error'
import { trpcClient } from '@/platform/renderer/trpc-client'
import { SessionContractError } from '../../session-contract-error'
import { sessionListQueryKey } from '../../session-queries'
import type { SessionListPage } from '../../types'

const SESSION_PAGE_SIZE = 30

function sessionListPage(
  result: Awaited<ReturnType<typeof trpcClient.sessions.list.query>>,
): SessionListPage {
  const nextPage = result.page * result.pageSize < result.total ? result.page + 1 : null
  return {
    sessions: result.rows,
    total: result.total,
    nextPage,
    historyComplete: nextPage === null,
    partialFailures: [],
  }
}

export function sessionListQuery(
  enabled: boolean,
): UseInfiniteQueryOptions<
  SessionListPage,
  SessionContractError,
  InfiniteData<SessionListPage>,
  readonly unknown[],
  number
> {
  return {
    queryKey: sessionListQueryKey,
    staleTime: Infinity,
    enabled,
    initialPageParam: 1,
    getNextPageParam: (page) => page.nextPage,
    retry: false,
    queryFn: ({ pageParam }) =>
      trpcClient.sessions.list
        .query({ page: pageParam, pageSize: SESSION_PAGE_SIZE })
        .then(sessionListPage)
        .catch(() => {
          throw new SessionContractError(sessionError('internal-error', null))
        }),
  }
}

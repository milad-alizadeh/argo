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
  }
}

export function sessionListQuery(
  projectId: string | null,
  enabled: boolean,
  search = '',
): UseInfiniteQueryOptions<
  SessionListPage,
  SessionContractError,
  InfiniteData<SessionListPage>,
  readonly unknown[],
  number
> {
  return {
    queryKey:
      projectId === null
        ? [...sessionListQueryKey('unselected', search)]
        : sessionListQueryKey(projectId, search),
    staleTime: Infinity,
    enabled: enabled && projectId !== null,
    initialPageParam: 1,
    getNextPageParam: (page) => page.nextPage,
    retry: false,
    queryFn: ({ pageParam }) =>
      projectId === null
        ? Promise.reject(new Error('A Project must be selected before Sessions can be listed.'))
        : trpcClient.sessions.list
            .query({ projectId, search, page: pageParam, pageSize: SESSION_PAGE_SIZE })
            .then(sessionListPage)
            .catch(() => {
              throw new SessionContractError(sessionError('internal-error', null))
            }),
  }
}

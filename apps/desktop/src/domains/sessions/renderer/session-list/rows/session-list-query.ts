import type { InfiniteData, UseInfiniteQueryOptions } from '@tanstack/react-query'
import { sessionError } from '@/domains/sessions/api/session-error'
import type { RouterOutputs } from '@/platform/renderer/trpc-client'
import { trpcClient } from '@/platform/renderer/trpc-client'
import { SessionContractError } from '../../session-contract-error'
import { sessionRosterQueryKey } from '../../session-queries'
import type { Session, SessionRoster } from '../../types'

const SESSION_PAGE_SIZE = 30

type ListedSession = RouterOutputs['sessions']['list']['rows'][number]

function rendererTitle(title: ListedSession['title']): Session['title'] {
  if (title === null) return null
  switch (title.source) {
    case 'custom':
      return { text: title.text, source: 'custom' }
    case 'vendor-preview':
      return { text: title.text, source: 'summarised' }
    case 'first-prompt':
      return { text: title.text, source: 'first-prompt' }
  }
}

function rendererSession(row: ListedSession): Session {
  return {
    id: row.id,
    retiredIds: [],
    harness: row.harness,
    posture: 'external',
    title: rendererTitle(row.title),
    status: 'unknown',
    entry: 'interactive',
    cwd: row.cwd,
    branch: null,
    updatedAt: new Date(row.updatedAt).toISOString(),
    unreadableLines: 0,
    originUnread: false,
    turnStartedAt: null,
    activity: null,
    plan: null,
    subagents: [],
    shell: [],
    pullRequest: null,
    ticket: null,
    archived: false,
    unread: false,
    turnConfiguration: { model: null, effort: null, mode: null },
  }
}

function rendererPage(result: RouterOutputs['sessions']['list']): SessionRoster {
  const nextPage = result.page * result.pageSize < result.total ? result.page + 1 : null
  return {
    sessions: result.rows.map(rendererSession),
    total: result.total,
    nextPage,
    historyComplete: nextPage === null,
    partialFailures: [],
  }
}

export function sessionListQuery(
  enabled: boolean,
): UseInfiniteQueryOptions<
  SessionRoster,
  SessionContractError,
  InfiniteData<SessionRoster>,
  readonly unknown[],
  number
> {
  return {
    queryKey: sessionRosterQueryKey,
    staleTime: Infinity,
    enabled,
    initialPageParam: 1,
    getNextPageParam: (page) => page.nextPage,
    retry: false,
    queryFn: ({ pageParam }) =>
      trpcClient.sessions.list
        .query({ page: pageParam, pageSize: SESSION_PAGE_SIZE })
        .then(rendererPage)
        .catch(() => {
          throw new SessionContractError(sessionError('internal-error', null))
        }),
  }
}

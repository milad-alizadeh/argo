import { useCallback, useMemo, useState } from 'react'
import { sessionError } from '@/domains/sessions/api/session-error'
import { useSessionRoster } from '../session-roster'
import { useSessionSync } from './use-session-sync'

export function useSessionList({
  projectId,
  enabled = true,
  search = '',
}: {
  projectId: string | null
  enabled?: boolean
  search?: string
}) {
  const sync = useSessionSync()
  const input = { projectId: projectId ?? 'unselected', search }
  const inputKey = JSON.stringify(input)
  // The window this reader asked for, reset when it reads another roster.
  const [requested, setRequested] = useState({ inputKey, pages: 1 })
  const pages = requested.inputKey === inputKey ? requested.pages : 1
  const roster = useSessionRoster(input, pages, enabled && projectId !== null)
  const list = roster?.list ?? null
  const error = roster?.failed === true ? sessionError('internal-error', null) : null
  const hasMoreSessions = list !== null && list.rows.length < list.total
  const isFetchingMoreSessions = list !== null && list.pages < pages
  const sessionList = useMemo(() => {
    if (list === null || error !== null) return null
    const more = list.rows.length < list.total
    return {
      total: list.total,
      sessions: list.rows,
      nextPage: more ? list.pages + 1 : null,
      historyComplete: !more,
    }
  }, [error, list])
  const loadedPages = list?.pages ?? 0
  return {
    sessionList,
    sessionListError: error,
    loadedSessionPages: loadedPages,
    hasMoreSessions,
    isFetchingMoreSessions,
    fetchMoreSessions: useCallback(() => {
      if (!hasMoreSessions || isFetchingMoreSessions) return
      setRequested({ inputKey, pages: loadedPages + 1 })
    }, [hasMoreSessions, inputKey, isFetchingMoreSessions, loadedPages]),
    refreshSessions: sync.refresh,
    refreshingSessions: sync.refreshing,
    syncStatus: sync.status,
  }
}

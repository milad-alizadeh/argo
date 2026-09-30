import { useCallback, useMemo, useRef } from 'react'
import { sessionError } from '@/domains/sessions/api/session-error'
import type { SessionListRetainedWindow } from '../types'
import { useSessionListWindow } from './session-list-window'
import type { SessionListAnchor } from './session-list-window-reader'
import { useSessionSync } from './use-session-sync'

// A visible row this close to either end of the retained window moves the window.
const EDGE_ROWS = 10

function anchorAt(page: SessionListRetainedWindow, index: number): SessionListAnchor {
  const row = page.sessions[index - page.offset]
  if (row !== undefined) return { kind: 'key', listOrderAt: row.listOrderAt, id: row.id }
  return index === 0 ? { kind: 'start' } : { kind: 'index', index }
}

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
  const read = useSessionListWindow(
    { projectId: projectId ?? 'unselected', search },
    enabled && projectId !== null,
  )
  const { window, seek } = read
  const error = read.failed ? sessionError('internal-error', null) : null
  const sessionList = useMemo<SessionListRetainedWindow | null>(
    () =>
      window === null || error !== null
        ? null
        : { total: window.total, offset: window.offset, sessions: window.rows },
    [error, window],
  )
  // The index the last seek asked for, until its window lands, so a scroll asks once per move.
  const sought = useRef<{ window: SessionListRetainedWindow | null; index: number } | null>(null)
  // Takes the visible range in list positions; loaded rows outside the window are dropped.
  const showRange = useCallback(
    (start: number, end: number) => {
      if (sessionList === null) return
      const loadedEnd = sessionList.offset + sessionList.sessions.length
      const earlier = sessionList.offset > 0 && start < sessionList.offset + EDGE_ROWS
      const later = loadedEnd < sessionList.total && end >= loadedEnd - EDGE_ROWS
      if (!earlier && !later) return
      const pending = sought.current
      if (pending?.window === sessionList && Math.abs(pending.index - start) < EDGE_ROWS) return
      sought.current = { window: sessionList, index: start }
      seek(anchorAt(sessionList, start))
    },
    [seek, sessionList],
  )
  return {
    sessionList,
    sessionListError: error,
    showRange,
    refreshSessions: sync.refresh,
    refreshingSessions: sync.refreshing,
    syncStatus: sync.status,
  }
}

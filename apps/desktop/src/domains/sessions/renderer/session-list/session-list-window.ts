import { replaceEqualDeep, skipToken, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { queryClient, trpcClient } from '@/platform/renderer/trpc-client'
import type { SessionListWindow } from '../types'
import { type SessionListAnchor, SessionListWindowReader } from './session-list-window-reader'

// The rows one read keeps on each side of the first visible row: the whole retained window.
export const SESSION_LIST_ROWS_BEFORE = 20
export const SESSION_LIST_ROWS_AFTER = 40

export type SessionListWindowState = { window: SessionListWindow | null; failed: boolean }
type WindowInput = { projectId: string; search: string }

export const sessionListWindowPathKey = ['sessions', 'list-window'] as const
export const sessionListWindowQueryKey = ({
  projectId,
  search,
  view,
}: WindowInput & { view: string }) =>
  [...sessionListWindowPathKey, projectId, search, view] as const

// A row the new window holds unchanged keeps the object the old window drew, wherever it moved.
function reuseRows(previous: SessionListWindow | null, next: SessionListWindow): SessionListWindow {
  if (previous === null) return next
  const byId = new Map(previous.rows.map((row) => [row.id, row]))
  return {
    ...next,
    rows: next.rows.map((row) => {
      const before = byId.get(row.id)
      return before === undefined ? row : replaceEqualDeep(before, row)
    }),
  }
}

// One list view: a bounded window of rows around its anchor, read again after each change.
export function useSessionListWindow(input: WindowInput, enabled: boolean) {
  const [view] = useState(() => crypto.randomUUID())
  const { projectId, search } = input
  const reader = useRef<SessionListWindowReader<SessionListWindow> | null>(null)
  useEffect(() => {
    if (!enabled) return
    const queryKey = sessionListWindowQueryKey({ projectId, search, view })
    const fail = () =>
      queryClient.setQueryData<SessionListWindowState>(queryKey, (state) => ({
        window: state?.window ?? null,
        failed: true,
      }))
    const windows = new SessionListWindowReader<SessionListWindow>({
      read: (anchor) =>
        trpcClient.sessionListWindow.query({
          projectId,
          search,
          view,
          anchor,
          before: SESSION_LIST_ROWS_BEFORE,
          after: SESSION_LIST_ROWS_AFTER,
        }),
      publish: (window) =>
        queryClient.setQueryData<SessionListWindowState>(queryKey, (state) => ({
          window: reuseRows(state?.window ?? null, window),
          failed: false,
        })),
      fail,
    })
    reader.current = windows
    const changes = trpcClient.sessionListChanges.subscribe(
      { view },
      { onData: () => windows.invalidate(), onError: fail },
    )
    return () => {
      windows.dispose()
      changes.unsubscribe()
      if (reader.current === windows) reader.current = null
    }
  }, [enabled, projectId, search, view])
  const seek = useCallback((anchor: SessionListAnchor) => reader.current?.seek(anchor), [])
  const state = useQuery<SessionListWindowState>({
    queryKey: sessionListWindowQueryKey({ projectId, search, view }),
    queryFn: skipToken,
    staleTime: Number.POSITIVE_INFINITY,
    placeholderData: (previous, previousQuery) =>
      previous?.failed === false &&
      previousQuery?.queryKey[sessionListWindowPathKey.length] === projectId
        ? previous
        : undefined,
  }).data
  return { window: state?.window ?? null, failed: state?.failed ?? false, seek }
}

// A view no change listener attaches, so reading it holds no temporary Feed readers.
const SNAPSHOT_VIEW = '00000000-0000-4000-8000-00000000000a'

// The first window read once per mount, for a screen that lists Sessions without the Session List.
export function useSessionListSnapshot(projectId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...sessionListWindowPathKey, 'snapshot', projectId],
    queryFn:
      enabled && projectId !== null
        ? () =>
            trpcClient.sessionListWindow.query({
              projectId,
              view: SNAPSHOT_VIEW,
              anchor: { kind: 'start' },
              after: SESSION_LIST_ROWS_AFTER,
            })
        : skipToken,
    staleTime: 0,
  }).data
}

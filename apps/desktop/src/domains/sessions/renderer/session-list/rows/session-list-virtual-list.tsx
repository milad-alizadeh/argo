import { useVirtualizer } from '@tanstack/react-virtual'
import { type ComponentProps, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { Session, SessionId } from '../../types'
import { moveFocus } from './session-list-arrow-keys'
import { SESSION_LIST_ROW_HEIGHT, type SessionListMenuHandlers } from './session-list-rows'
import { SessionListLoadingMoreRow } from './session-list-status-row'
import { SessionRow } from './session-row'
import { SessionRowContextMenu } from './session-row-context-menu'

// Overscan generous enough to keep a sessionList's realistic session count fully mounted, so arrow-key
// navigation (which walks the mounted buttons) behaves the same as the flat list it replaces;
// windowing still kicks in for a Session list large enough to exceed it.
const OVERSCAN = 30

export function SessionListVirtualList({
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  onArchive,
  onFocus,
  onOpenTicket,
  onRename,
  onSelect,
  onToggleSelect,
  selectedIds,
  selectedSessionId,
  sessions,
  tabStop,
  unavailableSessionIds,
}: SessionListMenuHandlers &
  Pick<ComponentProps<typeof SessionRow>, 'onFocus' | 'onSelect' | 'onToggleSelect'> & {
    fetchNextPage: () => unknown
    hasNextPage: boolean
    isFetchingNextPage: boolean
    selectedIds: ReadonlySet<SessionId>
    selectedSessionId: SessionId | null
    sessions: readonly Session[]
    tabStop: SessionId | null
    unavailableSessionIds: ReadonlySet<SessionId>
  }) {
  const { t } = useTranslation('sessions')
  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: sessions.length,
    getScrollElement: () => scrollRef.current,
    getItemKey: (index) => sessions[index]?.id ?? index,
    estimateSize: () => SESSION_LIST_ROW_HEIGHT,
    overscan: OVERSCAN,
  })
  const items = virtualizer.getVirtualItems()
  // The visible range, not the overscanned items, says whether the reader reached the end (#2277).
  const lastVisibleIndex = virtualizer.range?.endIndex ?? -1
  useEffect(() => {
    if (sessions.length === 0 || lastVisibleIndex < sessions.length - 1) return
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, lastVisibleIndex, sessions.length])

  return (
    <div
      className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto py-3"
      data-slot="session-list-scroll"
      ref={scrollRef}
    >
      <SessionRowContextMenu
        onArchive={onArchive}
        onOpenTicket={onOpenTicket}
        onRename={onRename}
        sessions={sessions}
      >
        <nav aria-label={t('navigationLabel')} className="min-w-0">
          <ul
            className="relative flex min-w-0 flex-col px-3"
            onKeyDown={moveFocus}
            style={{ height: virtualizer.getTotalSize() }}
          >
            {items.map((item) => {
              const session = sessions[item.index]
              return (
                <li
                  className="absolute inset-x-3 top-0 pb-1"
                  data-index={item.index}
                  key={item.key}
                  ref={virtualizer.measureElement}
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  {session === undefined ? null : (
                    <SessionRow
                      checked={selectedIds.has(session.id)}
                      onFocus={onFocus}
                      onSelect={onSelect}
                      onToggleSelect={onToggleSelect}
                      selected={session.id === selectedSessionId}
                      session={session}
                      tabbable={session.id === tabStop}
                      unavailable={unavailableSessionIds.has(session.id)}
                    />
                  )}
                </li>
              )
            })}
          </ul>
          {isFetchingNextPage ? <SessionListLoadingMoreRow /> : null}
        </nav>
      </SessionRowContextMenu>
    </div>
  )
}

import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { SessionListItem } from '@/domains/sessions/contract/session-list'
import { HarnessLogo } from '../../harness/harness-logo'
import type { PendingSession } from '../../session-creation'
import { moveFocus } from './roster-arrow-keys'
import './session-roster-item.css'

const ROW_HEIGHT = 56

export type RosterListItem = SessionListItem | PendingSession

function idOf(session: RosterListItem): string {
  return 'argoId' in session ? session.argoId : session.id
}

function titleOf(session: RosterListItem, newSession: string): string {
  return 'argoId' in session
    ? (session.vendorTitle ?? session.firstPrompt ?? session.nativeId)
    : (session.prompt ?? newSession)
}

function SessionButton({
  session,
  selected,
  tabbable,
  onSelect,
}: {
  session: RosterListItem
  selected: boolean
  tabbable: boolean
  onSelect: (sessionId: string) => void
}) {
  const { t } = useTranslation('sessions')
  const id = idOf(session)
  return (
    <button
      aria-current={selected ? 'page' : undefined}
      className={`group relative flex w-full items-start gap-2 overflow-hidden rounded-lg px-2 py-2 text-left focus-visible:ring-2 focus-visible:ring-ring ${selected ? 'bg-selected text-foreground' : 'hover:bg-muted'}`}
      data-session-id={id}
      onClick={() => onSelect(id)}
      tabIndex={tabbable ? 0 : -1}
      type="button"
    >
      <span aria-hidden="true" className="relative flex h-5 w-4 shrink-0 items-center">
        <span className="roster-harness-mark">
          <span data-slot="harness-logo">
            <HarnessLogo harness={session.harness} />
          </span>
        </span>
        <span
          className="roster-session-status absolute -right-0.5 bottom-0 size-(--size-state-dot) rounded-full"
          data-variant="idle"
          data-slot="session-status"
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate type-body font-medium text-foreground">
          {titleOf(session, t('newSession'))}
        </span>
        {'argoId' in session ? (
          <time
            className="mt-1 block type-meta text-faint"
            dateTime={new Date(session.updatedAt).toISOString()}
          >
            {new Date(session.updatedAt).toLocaleDateString()}
          </time>
        ) : null}
      </span>
    </button>
  )
}

export function RosterVirtualList({
  sessions,
  selectedSessionId,
  onSelect,
  hasNextPage,
  isFetchingNextPage,
  onFetchNextPage,
}: {
  sessions: readonly RosterListItem[]
  selectedSessionId: string | null
  onSelect: (sessionId: string) => void
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onFetchNextPage: () => void
}) {
  const { t } = useTranslation('sessions')
  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: sessions.length + (hasNextPage ? 1 : 0),
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 30,
  })
  const items = virtualizer.getVirtualItems()
  const lastIndex = items.at(-1)?.index ?? -1
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && lastIndex >= sessions.length - 1) onFetchNextPage()
  }, [hasNextPage, isFetchingNextPage, lastIndex, onFetchNextPage, sessions.length])

  return (
    <div
      className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto py-3"
      data-slot="roster-scroll"
      ref={scrollRef}
    >
      <nav aria-label={t('sidebarLabel')} className="min-w-0">
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
                {session === undefined ? (
                  <span className="block px-2 py-2 type-meta text-faint">{t('loading')}</span>
                ) : (
                  <SessionButton
                    session={session}
                    selected={idOf(session) === selectedSessionId}
                    tabbable={
                      idOf(session) === selectedSessionId ||
                      (selectedSessionId === null && item.index === 0)
                    }
                    onSelect={onSelect}
                  />
                )}
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}

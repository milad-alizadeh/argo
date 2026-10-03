import { useVirtualizer } from '@tanstack/react-virtual'
import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { matchesShortcut, pressedKeys, SESSION_LIST_MOVES } from '@/platform/contract/commands'
import { Icon } from '@/platform/renderer/components/icon/icon'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/platform/renderer/components/ui/context-menu'
import { useSessionTitleText } from '../prompt'
import type { Session, SessionId } from '../types'
import { SESSION_LIST_ROW_HEIGHT, SessionRow } from './session-row'

const OVERSCAN = 30
const MENU_TRIGGER = <div />

type SessionMenuHandlers = {
  onArchive: (sessionId: SessionId) => void
  onOpenTicket: (session: Session) => void
  onRename: (session: Session) => void
}

export type SessionPages = {
  fetchNextPage: () => unknown
  hasNextPage: boolean
  isFetchingNextPage: boolean
}

// One clock for every row's age, so the list re-renders once a minute rather than each row.
function useMinuteClock() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

function useNextPageAtTheEnd(lastVisibleIndex: number, count: number, pages: SessionPages) {
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = pages
  useEffect(() => {
    if (count === 0 || lastVisibleIndex < count - 1) return
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
  }, [count, fetchNextPage, hasNextPage, isFetchingNextPage, lastVisibleIndex])
}

type SessionListMove = keyof typeof SESSION_LIST_MOVES
const MOVES = Object.entries(SESSION_LIST_MOVES) as [SessionListMove, string][]

function moveFocus(event: KeyboardEvent<HTMLUListElement>) {
  const pressed = pressedKeys(event)
  const move = MOVES.find(([, command]) => matchesShortcut(command, pressed))?.[0]
  if (move === undefined) return
  const buttons = [
    ...event.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-session-id]'),
  ]
  const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
  if (current === -1) return
  event.preventDefault()
  const nextByMove = {
    next: Math.min(current + 1, buttons.length - 1),
    previous: Math.max(current - 1, 0),
    first: 0,
    last: buttons.length - 1,
  } satisfies Record<SessionListMove, number>
  buttons[nextByMove[move]]?.focus()
}

function menuTargetOf(element: EventTarget | null, sessions: readonly Session[]) {
  const row = element instanceof Element ? element.closest('[data-session-id]') : null
  const sessionId = row?.getAttribute('data-session-id') ?? null
  return sessions.find((session) => session.id === sessionId) ?? null
}

function SessionMenuItems({
  onArchive,
  onOpenTicket,
  onRename,
  target,
}: SessionMenuHandlers & { target: Session }) {
  const { t } = useTranslation('sessions')
  const title = useSessionTitleText(target.name)
  return (
    <ContextMenuContent aria-label={t('contextMenu.actions', { title })}>
      <ContextMenuGroup>
        <ContextMenuItem onClick={() => onRename(target)}>
          {t('contextMenu.rename')}
        </ContextMenuItem>
        {target.ticket !== null ? (
          <ContextMenuItem onClick={() => onOpenTicket(target)}>
            {t('contextMenu.openTicket')}
          </ContextMenuItem>
        ) : null}
        {target.archived ? null : (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => onArchive(target.id)}>
              <Icon name="archive-session" />
              {t('bulkSelect.archive')}
            </ContextMenuItem>
          </>
        )}
      </ContextMenuGroup>
    </ContextMenuContent>
  )
}

// One menu for the whole list, opened on the row under the pointer: a menu per row mounted 46034
// ContextMenuTriggers in a 4.25s fling, 17.1s of render time, for menus nobody opened.
function SessionContextMenu({
  children,
  handlers,
  sessions,
}: {
  children: ReactNode
  handlers: SessionMenuHandlers
  sessions: readonly Session[]
}) {
  const [target, setTarget] = useState<Session | null>(null)
  const [open, setOpen] = useState(false)
  // The trigger opens in the event that names the row, before the state lands, so it reads a ref.
  const pointed = useRef<Session | null>(null)
  const readTarget = (event: MouseEvent) => {
    pointed.current = menuTargetOf(event.target, sessions)
    setTarget(pointed.current)
  }
  return (
    <ContextMenu onOpenChange={(next) => setOpen(next && pointed.current !== null)} open={open}>
      <ContextMenuTrigger onContextMenuCapture={readTarget} render={MENU_TRIGGER}>
        {children}
      </ContextMenuTrigger>
      {target === null ? null : <SessionMenuItems {...handlers} target={target} />}
    </ContextMenu>
  )
}

// The bottom of the list while the next page arrives: one row tall, the spinner centred in it.
function LoadingMoreRow() {
  const { t } = useTranslation('sessions')
  return (
    <div
      aria-label={t('loadingMoreSessions')}
      className="flex items-center justify-center"
      role="status"
      style={{ height: SESSION_LIST_ROW_HEIGHT }}
    >
      <Icon
        name="loading"
        className="size-4 animate-spin text-muted-foreground motion-reduce:animate-none"
      />
    </div>
  )
}

type SessionRowsProps = {
  menu: SessionMenuHandlers
  onFocus: (sessionId: SessionId) => void
  onSelect: (sessionId: SessionId) => void
  onToggleSelect: Parameters<typeof SessionRow>[0]['onToggleSelect']
  pages: SessionPages
  selectedIds: ReadonlySet<SessionId>
  selectedSessionId: SessionId | null
  sessions: readonly Session[]
  tabStop: SessionId | null
  unavailableSessionIds: ReadonlySet<SessionId>
}

// The mounted window of rows, and the spinner row while the next page arrives.
export function SessionRows(props: SessionRowsProps) {
  const { t } = useTranslation('sessions')
  const { pages, selectedIds, selectedSessionId, sessions, tabStop, unavailableSessionIds } = props
  const now = useMinuteClock()
  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: sessions.length,
    getScrollElement: () => scrollRef.current,
    getItemKey: (index) => sessions[index]?.id ?? index,
    estimateSize: () => SESSION_LIST_ROW_HEIGHT,
    overscan: OVERSCAN,
  })
  useNextPageAtTheEnd(virtualizer.range?.endIndex ?? -1, sessions.length, pages)
  const rowOf = (session: Session) => (
    <SessionRow
      checked={selectedIds.has(session.id)}
      now={now}
      onFocus={props.onFocus}
      onSelect={props.onSelect}
      onToggleSelect={props.onToggleSelect}
      selected={session.id === selectedSessionId}
      session={session}
      tabbable={session.id === tabStop}
      unavailable={unavailableSessionIds.has(session.id)}
    />
  )
  return (
    <div
      className="min-h-0 min-w-0 flex-1 scroll-fade overflow-x-hidden overflow-y-auto py-3"
      data-slot="session-list-scroll"
      ref={scrollRef}
    >
      <SessionContextMenu handlers={props.menu} sessions={sessions}>
        <nav aria-label={t('navigationLabel')} className="min-w-0">
          <ul
            className="relative flex min-w-0 flex-col px-3"
            onKeyDown={moveFocus}
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualizer.getVirtualItems().map((item) => {
              const session = sessions[item.index]
              return (
                <li
                  className="absolute inset-x-3 top-0 pb-1"
                  data-index={item.index}
                  key={item.key}
                  ref={virtualizer.measureElement}
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  {session === undefined ? null : rowOf(session)}
                </li>
              )
            })}
          </ul>
          {pages.isFetchingNextPage ? <LoadingMoreRow /> : null}
        </nav>
      </SessionContextMenu>
    </div>
  )
}

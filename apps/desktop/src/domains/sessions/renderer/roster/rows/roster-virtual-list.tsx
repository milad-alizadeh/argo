import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual'
import { type MouseEvent, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SessionListItem } from '@/domains/sessions/contract/session-list'
import { Icon } from '@/platform/renderer/components/icon/icon'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/platform/renderer/components/ui/context-menu'
import { HarnessLogo } from '../../harness/harness-logo'
import type { PendingSession } from '../../session-creation'
import type { SelectionModifier } from '../hooks/roster-selection'
import { moveFocus } from './roster-arrow-keys'
import './session-roster-item.css'

const ROW_HEIGHT = 56
const TRIGGER = <div className="flex min-h-0 min-w-0 flex-1 flex-col" />

export type RosterListItem = SessionListItem | PendingSession

function idOf(session: RosterListItem): string {
  return 'argoId' in session ? session.argoId : session.id
}

function titleOf(session: RosterListItem, newSession: string): string {
  return 'argoId' in session
    ? (session.argoTitle ?? session.vendorTitle ?? session.firstPrompt ?? session.nativeId)
    : (session.prompt ?? newSession)
}

function rowHighlight(selected: boolean, checked: boolean, archived: boolean): string {
  if (selected || checked) return 'bg-selected text-foreground'
  if (archived) return 'border border-border/70 bg-muted/50 text-muted-foreground hover:bg-muted'
  return 'hover:bg-muted'
}

function SessionButton({
  session,
  selected,
  tabbable,
  onSelect,
  checked,
  onToggleSelect,
}: {
  session: RosterListItem
  selected: boolean
  tabbable: boolean
  onSelect: (sessionId: string) => void
  checked: boolean
  onToggleSelect: (sessionId: string, modifier: SelectionModifier) => void
}) {
  const { t } = useTranslation('sessions')
  const id = idOf(session)
  const archived = 'argoId' in session && session.archived
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (!archived && (event.shiftKey || event.metaKey || event.ctrlKey)) {
      onToggleSelect(id, event.shiftKey ? 'range' : 'additive')
      return
    }
    onSelect(id)
  }
  return (
    <button
      aria-current={selected ? 'page' : undefined}
      className={`group relative flex w-full items-start gap-2 overflow-hidden rounded-lg px-2 py-2 text-left focus-visible:ring-2 focus-visible:ring-ring ${rowHighlight(selected, checked, archived)}`}
      data-session-id={id}
      data-archived={archived}
      onClick={handleClick}
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
          data-variant={'argoId' in session ? 'unknown' : 'idle'}
          data-slot="session-status"
        />
      </span>
      <span className="sr-only">
        {'argoId' in session ? t('rosterStatusUnknown') : t('rosterStatusStarting')}
      </span>
      {checked ? <span className="sr-only">{t('bulkSelect.selected')}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="block min-w-0 truncate type-body font-medium text-foreground">
            {titleOf(session, t('newSession'))}
          </span>
          {archived ? (
            <span
              className="inline-flex shrink-0 rounded-full border border-border/70 bg-background/70 px-1.5 py-0.5 type-meta font-medium text-muted-foreground"
              data-slot="archived-session"
            >
              {t('rosterStatusArchived')}
            </span>
          ) : null}
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

function VirtualRows({
  sessions,
  selectedSessionId,
  selectedIds,
  onSelect,
  onToggleSelect,
  items,
  totalSize,
  measureElement,
}: {
  sessions: readonly RosterListItem[]
  selectedSessionId: string | null
  selectedIds: ReadonlySet<string>
  onSelect: (sessionId: string) => void
  onToggleSelect: (sessionId: string, modifier: SelectionModifier) => void
  items: VirtualItem[]
  totalSize: number
  measureElement: (element: Element | null) => void
}) {
  const { t } = useTranslation('sessions')
  return (
    <nav aria-label={t('sidebarLabel')} className="min-w-0">
      <ul
        className="relative flex min-w-0 flex-col px-3"
        onKeyDown={moveFocus}
        style={{ height: totalSize }}
      >
        {items.map((item) => {
          const session = sessions[item.index]
          return (
            <li
              className="absolute inset-x-3 top-0 pb-1"
              data-index={item.index}
              key={item.key}
              ref={measureElement}
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
                  checked={selectedIds.has(idOf(session))}
                  onToggleSelect={onToggleSelect}
                />
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function IndexedRowMenu({
  target,
  selectedIds,
  onRename,
  onArchive,
}: {
  target: SessionListItem | null
  selectedIds: ReadonlySet<string>
  onRename: (session: SessionListItem) => void
  onArchive: (sessionIds: string[], archived: boolean) => void
}) {
  const { t } = useTranslation('sessions')
  if (target === null) return null
  return (
    <ContextMenuContent
      aria-label={t('contextMenu.actions', { title: titleOf(target, t('newSession')) })}
    >
      <ContextMenuGroup>
        <ContextMenuItem onClick={() => onRename(target)}>
          {t('contextMenu.rename')}
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() =>
            onArchive(
              selectedIds.has(target.argoId) ? [...selectedIds] : [target.argoId],
              !target.archived,
            )
          }
        >
          <Icon name="archive-session" />
          {target.archived ? t('bulkSelect.undo') : t('bulkSelect.archive')}
        </ContextMenuItem>
      </ContextMenuGroup>
    </ContextMenuContent>
  )
}

export function RosterVirtualList({
  sessions,
  selectedSessionId,
  onSelect,
  selectedIds,
  onToggleSelect,
  onArchive,
  onRename,
  hasNextPage,
  isFetchingNextPage,
  onFetchNextPage,
}: {
  sessions: readonly RosterListItem[]
  selectedSessionId: string | null
  onSelect: (sessionId: string) => void
  selectedIds: ReadonlySet<string>
  onToggleSelect: (sessionId: string, modifier: SelectionModifier) => void
  onArchive: (sessionIds: string[], archived: boolean) => void
  onRename: (session: SessionListItem) => void
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onFetchNextPage: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [target, setTarget] = useState<SessionListItem | null>(null)
  const pointed = useRef<SessionListItem | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
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
    <ContextMenu
      onOpenChange={(open) => setMenuOpen(open && pointed.current !== null)}
      open={menuOpen}
    >
      <ContextMenuTrigger
        onContextMenuCapture={(event) => {
          const element =
            event.target instanceof Element ? event.target.closest('[data-session-id]') : null
          const found = sessions.find(
            (session) =>
              'argoId' in session && session.argoId === element?.getAttribute('data-session-id'),
          )
          pointed.current = found && 'argoId' in found ? found : null
          setTarget(pointed.current)
        }}
        render={TRIGGER}
      >
        <div
          className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto py-3"
          data-slot="roster-scroll"
          ref={scrollRef}
        >
          <VirtualRows
            sessions={sessions}
            selectedSessionId={selectedSessionId}
            selectedIds={selectedIds}
            onSelect={onSelect}
            onToggleSelect={onToggleSelect}
            items={items}
            totalSize={virtualizer.getTotalSize()}
            measureElement={virtualizer.measureElement}
          />
        </div>
      </ContextMenuTrigger>
      <IndexedRowMenu
        target={target}
        selectedIds={selectedIds}
        onRename={onRename}
        onArchive={onArchive}
      />
    </ContextMenu>
  )
}

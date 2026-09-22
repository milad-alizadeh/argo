import { type MouseEvent, type ReactNode, useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/platform/renderer/components/icon/icon'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/platform/renderer/components/ui/context-menu'
import type { Session } from '../../types'
import { type RosterMenuHandlers, type RosterRow, renamedSession, sessionName } from './roster-rows'

type RosterMenuTarget = { session: Session; archived: boolean }

// One element, because base-ui reads `render` as a prop: a fresh one each render is a changed prop.
const TRIGGER = <div />

function targetOf(
  element: EventTarget | null,
  rows: readonly RosterRow[],
  renamedTitles: Record<string, string>,
): RosterMenuTarget | null {
  const row = element instanceof Element ? element.closest('[data-session-id]') : null
  const sessionId = row?.getAttribute('data-session-id') ?? null
  for (const entry of rows) {
    if (entry.kind !== 'session' || entry.session.id !== sessionId) continue
    return { archived: entry.archived, session: renamedSession(entry.session, renamedTitles) }
  }
  return null
}

// One menu for the whole list, opened on the row under the pointer, rather than one menu per row. A
// row used to carry its own: a fling through the roster then mounted 46034 ContextMenuTriggers in
// 4.25s, 17.1s of render time, for menus nobody opened.
export function RosterContextMenu({
  children,
  onArchive,
  onLinkTicket,
  onOpenTicket,
  onRename,
  onUnlinkTicket,
  renamedTitles,
  rows,
}: RosterMenuHandlers & {
  children: ReactNode
  renamedTitles: Record<string, string>
  rows: readonly RosterRow[]
}) {
  const { t } = useTranslation('sessions')
  const [target, setTarget] = useState<RosterMenuTarget | null>(null)
  const [open, setOpen] = useState(false)
  // A ref beside the state, because the trigger opens the menu in the same event that names the row:
  // the state has not landed yet when it asks whether to open.
  const pointed = useRef<RosterMenuTarget | null>(null)
  // The rows are read at click time, through a ref. A roster read rebuilds them several times a
  // second while a Session runs, and a handler that closed over them changed the trigger's props
  // every time, for a menu nobody had opened (#2386).
  const list = useRef({ renamedTitles, rows })
  list.current = { renamedTitles, rows }

  const readTarget = useCallback((event: MouseEvent) => {
    const found = targetOf(event.target, list.current.rows, list.current.renamedTitles)
    pointed.current = found
    setTarget(found)
  }, [])
  const openChanged = useCallback((next: boolean) => setOpen(next && pointed.current !== null), [])

  return (
    <ContextMenu onOpenChange={openChanged} open={open}>
      <ContextMenuTrigger onContextMenuCapture={readTarget} render={TRIGGER}>
        {children}
      </ContextMenuTrigger>
      {target === null ? null : (
        <ContextMenuContent
          aria-label={t('contextMenu.actions', {
            title: sessionName(target.session, t('newSession')),
          })}
        >
          <ContextMenuGroup>
            <ContextMenuItem onClick={() => onRename(target.session)}>
              {t('contextMenu.rename')}
            </ContextMenuItem>
            {target.session.ticket !== null ? (
              <>
                <ContextMenuItem onClick={() => onOpenTicket(target.session)}>
                  {t('contextMenu.openTicket')}
                </ContextMenuItem>
                <ContextMenuItem onClick={() => onUnlinkTicket(target.session)}>
                  {t('contextMenu.unlinkTicket')}
                </ContextMenuItem>
              </>
            ) : (
              <ContextMenuItem onClick={() => onLinkTicket(target.session)}>
                {t('contextMenu.linkTicket')}
              </ContextMenuItem>
            )}
            {target.archived ? null : (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => onArchive(target.session.id)}>
                  <Icon name="archive-session" />
                  {t('bulkSelect.archive')}
                </ContextMenuItem>
              </>
            )}
          </ContextMenuGroup>
        </ContextMenuContent>
      )}
    </ContextMenu>
  )
}

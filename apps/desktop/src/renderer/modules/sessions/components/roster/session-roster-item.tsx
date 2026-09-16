import { Archive } from 'lucide-react'
import type { MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/renderer/components/ui/context-menu'
import { HarnessLogo } from '../../harness/harness-logo'
import { SESSION_CLIS, type SessionCli, sessionCliOf } from '../../harness/harnesses'
import { PromptText } from '../../prompt/prompt-text'
import type { SelectionModifier } from '../../state/roster-selection'
import type { Session } from '../../types'
import { SessionReferenceText } from '../composer/references/session-reference'
import { SessionMetadata } from './session-roster-metadata'
import './session-roster-item.css'
import {
  SessionBlockedBadge,
  SessionLockedMark,
  STATUS_LABELS,
  STATUS_MARKS,
} from './session-roster-status'

function selectionModifierOf(event: {
  shiftKey: boolean
  metaKey: boolean
  ctrlKey: boolean
}): SelectionModifier {
  if (event.shiftKey) return 'range'
  if (event.metaKey || event.ctrlKey) return 'additive'
  return 'plain'
}

function knownCli(cli: string): cli is SessionCli {
  return (SESSION_CLIS as readonly string[]).includes(cli)
}

function activitySummary(session: Session): string | null {
  if (session.activity === null) return null
  return session.activity.label
}

function sessionName(session: Session): string {
  return session.title?.text ?? session.id
}

function rowHighlightOf(checked: boolean, selected: boolean): string {
  if (checked) return 'bg-accent text-accent-foreground'
  if (selected) return 'bg-selected text-foreground'
  return ''
}

export function SessionRosterItem({
  archived,
  checked,
  onArchive,
  onFocus,
  onSelect,
  onRename,
  onOpenTicket,
  onLinkTicket,
  onUnlinkTicket,
  onToggleSelect,
  selectable,
  selected,
  session,
  tabIndex,
}: {
  archived: boolean
  checked: boolean
  onArchive?: () => void
  onFocus: () => void
  onSelect: () => void
  onRename: () => void
  onOpenTicket: () => void
  onLinkTicket: () => void
  onUnlinkTicket: () => void
  onToggleSelect: (modifier: SelectionModifier) => void
  selectable: boolean
  selected: boolean
  session: Session
  tabIndex: number
}) {
  const { t } = useTranslation('sessions')
  const activity = activitySummary(session)
  const rowHighlight = rowHighlightOf(checked, selected)
  // A shift- or platform-modifier click selects (ranges or adds to the bulk selection) instead of
  // opening the Session, so no checkbox is needed for multi-select (#2194, dropped per review). A
  // plain click keeps opening the Session, as it did before selection existed.
  function handleRowClick(event: MouseEvent) {
    if (selectable && (event.shiftKey || event.metaKey || event.ctrlKey)) {
      onToggleSelect(selectionModifierOf(event))
      return
    }
    onSelect()
  }
  return (
    <div className="min-w-0">
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <button
              aria-current={selected ? 'page' : undefined}
              className={`group flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring ${rowHighlight}`}
              data-archived={archived}
              data-session-id={session.id}
              onClick={handleRowClick}
              onFocus={onFocus}
              tabIndex={tabIndex}
              type="button"
            >
              <span aria-hidden="true" className="relative flex h-5 w-4 shrink-0 items-center">
                <span className="roster-harness-mark">
                  {knownCli(session.cli) ? <HarnessLogo cli={session.cli} /> : null}
                </span>
                <span
                  className={`absolute -right-0.5 bottom-0 size-(--size-state-dot) rounded-full ${STATUS_MARKS[session.status]}`}
                />
              </span>
              <span className="sr-only">{STATUS_LABELS[session.status]}</span>
              {checked ? <span className="sr-only">{t('bulkSelect.selected')}</span> : null}
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="block min-w-0 truncate type-body font-medium text-foreground">
                    <PromptText
                      interactiveLinks={false}
                      renderText={(value) => (
                        <SessionReferenceText cli={sessionCliOf(session)} text={value} />
                      )}
                      text={sessionName(session)}
                    />
                  </span>
                  <SessionBlockedBadge session={session} />
                  <SessionLockedMark session={session} />
                </span>
                {activity === null ? null : (
                  <span className="mt-0.5 block truncate type-meta text-faint">{activity}</span>
                )}
                <SessionMetadata session={session} />
              </span>
            </button>
          }
        />
        <ContextMenuContent aria-label={`${sessionName(session)} actions`}>
          <ContextMenuGroup>
            <ContextMenuLabel>{sessionName(session)}</ContextMenuLabel>
            <ContextMenuItem onClick={onRename}>{t('contextMenu.rename')}</ContextMenuItem>
            {session.ticket !== null ? (
              <>
                <ContextMenuItem onClick={onOpenTicket}>
                  {t('contextMenu.openTicket')}
                </ContextMenuItem>
                <ContextMenuItem onClick={onUnlinkTicket}>
                  {t('contextMenu.unlinkTicket')}
                </ContextMenuItem>
              </>
            ) : (
              <ContextMenuItem onClick={onLinkTicket}>
                {t('contextMenu.linkTicket')}
              </ContextMenuItem>
            )}
            {onArchive ? (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={onArchive}>
                  <Archive aria-hidden="true" />
                  {t('bulkSelect.archive')}
                </ContextMenuItem>
              </>
            ) : null}
          </ContextMenuGroup>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  )
}

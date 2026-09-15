import type { MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Checkbox } from '@/renderer/components/ui/checkbox'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuTrigger,
} from '@/renderer/components/ui/context-menu'
import { HarnessLogo } from '../harness/HarnessLogo'
import { SESSION_CLIS, type SessionCli, sessionCliOf } from '../harness/harnesses'
import { PromptText } from '../prompt/PromptText'
import type { SelectionModifier } from '../state/roster-selection'
import type { Session } from '../types'
import { SessionReferenceText } from './SessionReference'
import { SessionMetadata } from './SessionRosterMetadata'
import {
  SessionBlockedBadge,
  SessionLockedMark,
  STATUS_LABELS,
  STATUS_MARKS,
} from './SessionRosterStatus'

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
  return [session.activity.tool, session.activity.target].filter(Boolean).join(' ')
}

function sessionName(session: Session): string {
  return session.title?.text ?? session.id
}

export function SessionRosterItem({
  checked,
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
  checked: boolean
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
  const name = sessionName(session)
  return (
    <li className="min-w-0">
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <button
              aria-current={selected ? 'page' : undefined}
              className={`group flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring ${selected ? 'bg-muted text-foreground' : ''}`}
              data-session-id={session.id}
              onClick={onSelect}
              onFocus={onFocus}
              tabIndex={tabIndex}
              type="button"
            >
              {selectable ? (
                <Checkbox
                  aria-label={t('bulkSelect.selectRow', { title: name })}
                  checked={checked}
                  className="mt-1 shrink-0"
                  onClick={(event: MouseEvent) => {
                    event.stopPropagation()
                    onToggleSelect(selectionModifierOf(event))
                  }}
                />
              ) : null}
              <span className="flex min-w-0 flex-1 items-start gap-2">
                <span aria-hidden="true" className="relative flex h-5 w-4 shrink-0 items-center">
                  {knownCli(session.cli) ? <HarnessLogo cli={session.cli} /> : null}
                  <span
                    className={`absolute -right-0.5 bottom-0 size-(--size-state-dot) rounded-full ring-2 ring-sidebar ${STATUS_MARKS[session.status]}`}
                  />
                </span>
                <span className="sr-only">{STATUS_LABELS[session.status]}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="block min-w-0 truncate type-label font-medium text-foreground">
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
                    <span className="mt-0.5 block truncate type-roster-meta text-faint">
                      {activity}
                    </span>
                  )}
                  <SessionMetadata session={session} />
                </span>
              </span>
            </button>
          }
        />
        <ContextMenuContent aria-label={`${sessionName(session)} actions`}>
          <ContextMenuGroup>
            <ContextMenuLabel>{sessionName(session)}</ContextMenuLabel>
            <ContextMenuItem onClick={onRename}>Rename</ContextMenuItem>
            {session.ticket !== null ? (
              <>
                <ContextMenuItem onClick={onOpenTicket}>Open Ticket</ContextMenuItem>
                <ContextMenuItem onClick={onUnlinkTicket}>Unlink Ticket</ContextMenuItem>
              </>
            ) : (
              <ContextMenuItem onClick={onLinkTicket}>Link Ticket…</ContextMenuItem>
            )}
          </ContextMenuGroup>
        </ContextMenuContent>
      </ContextMenu>
    </li>
  )
}

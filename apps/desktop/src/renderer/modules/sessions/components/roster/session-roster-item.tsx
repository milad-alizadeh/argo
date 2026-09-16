import type { MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'

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

// A row that already carries a ground keeps it under the pointer: hover answers "this one is
// reachable", and a selected row has nothing left to say (#2273).
function rowHighlightOf(checked: boolean, selected: boolean): string {
  if (checked) return 'bg-accent text-accent-foreground'
  if (selected) return 'bg-selected text-foreground'
  return 'hover:bg-muted'
}

// The row carries no context menu of its own: the list holds one menu and reads the row under the
// pointer from `data-session-id` (roster-context-menu.tsx).
export function SessionRosterItem({
  archived,
  checked,
  onFocus,
  onSelect,
  onToggleSelect,
  selectable,
  selected,
  session,
  tabIndex,
}: {
  archived: boolean
  checked: boolean
  onFocus: () => void
  onSelect: () => void
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
      <button
        aria-current={selected ? 'page' : undefined}
        className={`group flex w-full select-none items-start gap-2 rounded-lg px-2 py-2 text-left focus-visible:ring-2 focus-visible:ring-ring ${rowHighlight}`}
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
    </div>
  )
}

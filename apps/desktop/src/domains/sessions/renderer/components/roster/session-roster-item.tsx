import { Archive } from 'lucide-react'
import { type MouseEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { HarnessLogo } from '../../harness/harness-logo'
import { SESSION_CLIS, type SessionCli, sessionCliOf } from '../../harness/harnesses'
import { PromptText } from '../../prompt/prompt-text'
import type { SelectionModifier } from '../../state/roster-selection'
import type { Session } from '../../types'
import { SessionReferenceText } from '../composer/references/session-reference'
import { sessionName } from './roster-rows'
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

// A row that already carries a ground keeps it under the pointer: hover answers "this one is
// reachable", and a selected row has nothing left to say (#2273).
function rowHighlightOf(checked: boolean, selected: boolean, archived: boolean): string {
  if (checked || selected) return 'bg-selected text-foreground'
  if (archived) return 'border border-border/70 bg-muted/50 text-muted-foreground hover:bg-muted'
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
  const [pointerFocused, setPointerFocused] = useState(false)
  const activity = activitySummary(session)
  const rowHighlight = rowHighlightOf(checked, selected, archived)
  const focusHighlight = pointerFocused
    ? 'focus-visible:outline-2 focus-visible:outline-transparent focus-visible:ring-0'
    : 'focus-visible:ring-2 focus-visible:ring-ring'
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
        className={`group flex w-full select-none items-start gap-2 rounded-lg px-2 py-2 text-left ${focusHighlight} ${rowHighlight}`}
        data-archived={archived}
        data-session-id={session.id}
        onBlur={() => setPointerFocused(false)}
        onClick={handleRowClick}
        onFocus={onFocus}
        onKeyDown={() => setPointerFocused(false)}
        onPointerDown={() => setPointerFocused(true)}
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
                text={sessionName(session, t('newSession'))}
              />
            </span>
            {archived ? (
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/70 bg-background/70 px-1.5 py-0.5 type-meta font-medium text-muted-foreground"
                data-slot="archived-session"
              >
                <Archive aria-hidden="true" className="size-3" />
                {t('rosterStatusArchived')}
              </span>
            ) : null}
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

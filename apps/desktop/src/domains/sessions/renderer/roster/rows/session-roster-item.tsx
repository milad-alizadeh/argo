import { type MouseEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SessionReferenceText } from '../../composer/references/session-reference'
import { useLiveActivityText } from '../../feed'
import {
  HarnessLogo,
  SESSION_HARNESSES,
  type SessionHarness,
  sessionHarnessOf,
} from '../../harness'
import { PromptText } from '../../prompt'
import type { Session } from '../../types'
import type { SelectionModifier } from '../hooks'
import { sessionName } from './roster-rows'
import { SessionMetadata } from './session-roster-metadata'
import './session-roster-item.css'
import { Icon } from '@/platform/renderer/components/icon/icon'
import {
  SessionBlockedBadge,
  SessionLockedMark,
  STATUS_LABELS,
  statusVariantOf,
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

function knownHarness(harness: string): harness is SessionHarness {
  return (SESSION_HARNESSES as readonly string[]).includes(harness)
}

// The same line the Feed's live tail draws, as still text: the shimmer is the Feed's.
function ActivityLine({ session }: { session: Session }) {
  const text = useLiveActivityText({
    activity: session.activity,
    running: session.status === 'running',
    compacting: (session.compactionStartedAt ?? null) !== null,
  })
  if (text === null) return null
  return <span className="mt-0.5 block truncate type-meta text-faint">{text}</span>
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
  const rowHighlight = rowHighlightOf(checked, selected, archived)
  const focusHighlight = pointerFocused
    ? 'focus-visible:outline-2 focus-visible:outline-transparent focus-visible:ring-0'
    : 'focus-visible:ring-2 focus-visible:ring-ring'
  const running = session.status === 'running'
  const statusVariant = statusVariantOf(session)
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
        className={`group relative flex w-full select-none items-start gap-2 overflow-hidden rounded-lg px-2 py-2 text-left ${focusHighlight} ${rowHighlight}`}
        data-archived={archived}
        data-session-id={session.id}
        onBlur={() => setPointerFocused(false)}
        onClick={handleRowClick}
        onFocus={onFocus}
        onKeyDown={(event) => {
          setPointerFocused(false)
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onSelect()
          }
        }}
        onPointerDown={() => setPointerFocused(true)}
        tabIndex={tabIndex}
        type="button"
      >
        <span aria-hidden="true" className="relative flex h-5 w-4 shrink-0 items-center">
          <span className="roster-harness-mark">
            <span data-active={running} data-slot="harness-logo">
              {knownHarness(session.harness) ? <HarnessLogo harness={session.harness} /> : null}
            </span>
          </span>
          <span
            className="roster-session-status absolute -right-0.5 bottom-0 size-(--size-state-dot) rounded-full"
            data-variant={statusVariant}
            data-slot="session-status"
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
                  <SessionReferenceText harness={sessionHarnessOf(session)} text={value} />
                )}
                text={sessionName(session, t('newSession'))}
              />
            </span>
            {archived ? (
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/70 bg-background/70 px-1.5 py-0.5 type-meta font-medium text-muted-foreground"
                data-slot="archived-session"
              >
                <Icon name="archive-session" className="size-3" />
                {t('rosterStatusArchived')}
              </span>
            ) : null}
            <SessionBlockedBadge session={session} />
            <SessionLockedMark session={session} />
            {session.unread ? <span className="sr-only">{t('rosterStatusUnread')}</span> : null}
          </span>
          <ActivityLine session={session} />
          {session.searchExcerpt === null || session.searchExcerpt === undefined ? null : (
            <span className="mt-0.5 block truncate type-meta text-faint">
              {session.searchExcerpt}
            </span>
          )}
          <SessionMetadata session={session} />
        </span>
      </button>
    </div>
  )
}

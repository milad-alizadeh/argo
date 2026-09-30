import { type MouseEvent, memo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { harnessSchema } from '@/harnesses/harness'
import { LiveActivityWords, useLiveActivityText } from '../../feed/rows/live-activity-text'
import { HarnessLogo } from '../../harness/harness-logo'
import { SessionTitle } from '../../prompt/session-title'
import type { Session, SessionId } from '../../types'
import type { SelectionModifier } from '../hooks/session-list-selection'
import { sessionName } from './session-list-rows'
import { SessionMetadata } from './session-row-metadata'
import './session-row.css'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { SessionBlockedBadge, statusVariantOf } from './session-row-status'

function selectionModifierOf(event: {
  shiftKey: boolean
  metaKey: boolean
  ctrlKey: boolean
}): SelectionModifier {
  if (event.shiftKey) return 'range'
  if (event.metaKey || event.ctrlKey) return 'additive'
  return 'plain'
}

// The same line the Feed's live tail draws, as still text: the shimmer is the Feed's.
function ActivityLine({ session }: { session: Session }) {
  const line = useLiveActivityText({
    activity: session.activity,
    running: session.status === 'running',
  })
  return (
    <span className="mt-0.5 block min-h-lh truncate type-meta text-faint">
      {line === null ? null : <LiveActivityWords line={line} />}
    </span>
  )
}

// A row that already carries a ground keeps it under the pointer: hover answers "this one is
// reachable", and a selected row has nothing left to say (#2273).
function rowHighlightOf(checked: boolean, selected: boolean, archived: boolean): string {
  if (checked || selected) return 'bg-selected text-foreground'
  if (archived) return 'border border-border/70 bg-muted/50 text-muted-foreground hover:bg-muted'
  return 'hover:bg-muted'
}

// Memoized with boolean props: a running Session rebuilds the list several times a second.
// The list's one context menu finds this row by `data-session-id` (session-row-context-menu.tsx).
export const SessionRow = memo(function SessionRow({
  checked: picked,
  onFocus,
  onSelect,
  onToggleSelect,
  selected,
  session,
  tabbable,
  unavailable,
}: {
  checked: boolean
  onFocus: (sessionId: SessionId) => void
  onSelect: (sessionId: SessionId) => void
  onToggleSelect: (sessionId: SessionId, modifier: SelectionModifier) => void
  selected: boolean
  session: Session
  tabbable: boolean
  unavailable: boolean
}) {
  const { t } = useTranslation('sessions')
  const [pointerFocused, setPointerFocused] = useState(false)
  const { archived } = session
  // An archived row takes no part in a bulk selection.
  const checked = picked && !archived
  const rowHighlight = rowHighlightOf(checked, selected, archived)
  const focusHighlight = pointerFocused
    ? 'focus-visible:outline-2 focus-visible:outline-transparent focus-visible:ring-0'
    : 'focus-visible:ring-2 focus-visible:ring-ring'
  const running = session.status === 'running'
  // The Roster stores an open Harness string (ADR-0021); an unknown one draws no logo.
  const harness = harnessSchema.safeParse(session.harness)
  const statusVariant = unavailable ? 'failed' : statusVariantOf(session)
  // A shift- or platform-modifier click selects (ranges or adds to the bulk selection) instead of
  // opening the Session, so no checkbox is needed for multi-select (#2194, dropped per review). A
  // plain click keeps opening the Session, as it did before selection existed.
  function handleRowClick(event: MouseEvent) {
    if (!archived && (event.shiftKey || event.metaKey || event.ctrlKey)) {
      onToggleSelect(session.id, selectionModifierOf(event))
      return
    }
    onSelect(session.id)
  }
  return (
    <div className="min-w-0">
      <button
        aria-current={selected ? 'page' : undefined}
        className={`group relative flex w-full select-none items-start gap-2 overflow-hidden rounded-lg pl-(--spacing-shell-icon) pr-2 py-2 text-left ${focusHighlight} ${rowHighlight}`}
        data-archived={archived}
        data-session-id={session.id}
        data-history-unavailable={unavailable}
        onBlur={() => setPointerFocused(false)}
        onClick={handleRowClick}
        onFocus={() => onFocus(session.id)}
        onKeyDown={(event) => {
          setPointerFocused(false)
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onSelect(session.id)
          }
        }}
        onPointerDown={() => setPointerFocused(true)}
        tabIndex={tabbable ? 0 : -1}
        type="button"
      >
        <span aria-hidden="true" className="relative flex h-5 w-4 shrink-0 items-center">
          <span className="session-list-harness-mark">
            <span data-active={running} data-slot="harness-logo">
              {harness.success ? <HarnessLogo harness={harness.data} /> : null}
            </span>
          </span>
          <span
            className="session-list-session-status absolute -right-0.5 bottom-0 size-(--size-state-dot) rounded-full"
            data-variant={statusVariant}
            data-slot="session-status"
          />
        </span>
        {/* The status dot's colour, in words for a reader it never reaches. */}
        {unavailable ? null : (
          <span className="sr-only">{t(`sessionStatus.${session.status}`)}</span>
        )}
        {checked ? <span className="sr-only">{t('bulkSelect.selected')}</span> : null}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="block min-w-0 truncate type-body font-medium text-foreground">
              <SessionTitle session={session} text={sessionName(session, t('newSession'))} />
            </span>
            {archived ? (
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/70 bg-background/70 px-1.5 py-0.5 type-meta font-medium text-muted-foreground"
                data-slot="archived-session"
              >
                <Icon name="archive-session" className="size-3" />
                {t('sessionListStatusArchived')}
              </span>
            ) : null}
            {unavailable ? (
              <span className="inline-flex shrink-0 rounded-full border border-danger/50 px-1.5 py-0.5 type-meta text-danger">
                {t('standing.missingHistoryBadge')}
              </span>
            ) : null}
            <SessionBlockedBadge session={session} />
          </span>
          <ActivityLine session={session} />
          <SessionMetadata session={session} />
        </span>
      </button>
    </div>
  )
})

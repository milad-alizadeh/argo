import { type MouseEvent, memo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isWorkingStatus } from '@/domains/sessions/api/session-live-event'
import { harnessSchema } from '@/harnesses/harness'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Badge } from '@/platform/renderer/components/ui/badge'
import { LiveActivityWords, useLiveActivityText } from '../feed'
import { HarnessLogo } from '../harness'
import { SessionTitle } from '../prompt'
import type { Session, SessionExtras, SessionId, SessionPlan } from '../types'
import type { SelectionModifier } from './hooks/session-list-selection'

// One row of the list, for the virtualizer's estimate and for the spinner and skeleton rows.
export const SESSION_LIST_ROW_HEIGHT = 56

type SessionStatusVariant = 'active' | 'attention' | 'failed' | 'idle' | 'unknown'

// `starting` keeps its idle mark until a Turn works.
const STATUS_VARIANTS = {
  running: 'active',
  starting: 'idle',
  asking: 'attention',
  permission: 'attention',
  ended: 'failed',
  stopped: 'failed',
  unknown: 'unknown',
  idle: 'idle',
} as const satisfies Record<Session['status'], SessionStatusVariant>

const STATUS_MARK = {
  active: 'bg-active shadow-state-glow animate-[status-light-blink_1.6s_ease-in-out_infinite]',
  attention:
    'bg-warn shadow-[0_0_5px_color-mix(in_srgb,var(--color-warn)_35%,transparent)] animate-[status-light-blink_1.6s_ease-in-out_infinite]',
  failed: 'bg-danger',
  idle: 'bg-idle',
  unknown: 'bg-transparent shadow-state-outline',
} satisfies Record<SessionStatusVariant, string>

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

// How long ago a settled Session last changed; a working one shows no time.
function sessionAge(session: Session, now: number) {
  const updatedAt = session.updatedAt === null ? Number.NaN : Date.parse(session.updatedAt)
  if (isWorkingStatus(session.status) || Number.isNaN(updatedAt)) return null
  return Math.max(0, Math.floor((now - updatedAt) / 60_000))
}

function compactDuration(minutes: number) {
  if (minutes < 1) return '<1m'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function SessionAge({ minutes, updatedAt }: { minutes: number; updatedAt: string }) {
  const { t } = useTranslation('sessions')
  const text = compactDuration(minutes)
  return (
    <time
      className="inline-flex shrink-0 tabular-nums"
      dateTime={updatedAt}
      title={minutes < 1 ? t('row.updatedJustNow') : t('row.updatedAgo', { duration: text })}
    >
      {text}
    </time>
  )
}

function planStepTone(plan: SessionPlan & { state: 'available' }, step: number, running: boolean) {
  const completed = plan.entries.filter((entry) => entry.status === 'completed').length
  if (step < completed) return running ? 'bg-foreground/70' : 'bg-muted-foreground/50'
  if (step === completed && running) return 'bg-foreground'
  return 'bg-border'
}

function SessionPlanBar({ plan, running }: { plan: SessionPlan; running: boolean }) {
  const { t } = useTranslation('sessions')
  if (plan.state === 'malformed') return <span>{t('sessionList.planUnreadable')}</span>
  const completed = plan.entries.filter((entry) => entry.status === 'completed').length
  return (
    <span
      aria-label={t('sessionList.planProgress', { completed, total: plan.entries.length })}
      className="flex h-(--size-plan-bar) w-16 shrink-0 gap-px"
      role="img"
    >
      {plan.entries.map((entry, step) => (
        <span
          className={`min-w-0 flex-1 rounded-full ${planStepTone(plan, step, running)}`}
          key={entry.position}
        />
      ))}
    </span>
  )
}

type RowSession = Session & Pick<SessionExtras, 'plan'>

function SessionRowMark({ session, unavailable }: { session: RowSession; unavailable: boolean }) {
  const running = session.status === 'running'
  const harness = harnessSchema.safeParse(session.harness)
  const statusVariant = unavailable ? 'failed' : STATUS_VARIANTS[session.status]
  return (
    <span aria-hidden="true" className="relative flex h-5 w-4 shrink-0 items-center">
      <span className="absolute inset-0 flex items-center mask-[radial-gradient(circle_at_calc(100%+var(--size-session-list-status-cutout)-var(--size-state-dot)/2)_calc(100%-var(--size-state-dot)/2),transparent_calc(var(--size-state-dot)/2+var(--size-session-list-status-cutout)),black_calc(var(--size-state-dot)/2+var(--size-session-list-status-cutout)))]">
        <span
          className={
            running
              ? 'inline-flex animate-[spin_2.4s_linear_infinite] motion-reduce:animate-none'
              : 'inline-flex'
          }
          data-active={running}
          data-slot="harness-logo"
        >
          {harness.success ? <HarnessLogo harness={harness.data} /> : null}
        </span>
      </span>
      <span
        className={`absolute -right-0.5 bottom-0 size-(--size-state-dot) rounded-full transition-[background-color,box-shadow,opacity] duration-(--duration-attention) ease-(--ease-emphasized) motion-reduce:animate-none motion-reduce:transition-none ${STATUS_MARK[statusVariant]}`}
        data-variant={statusVariant}
        data-slot="session-status"
      />
    </span>
  )
}

function SessionMetadata({ now, session }: { now: number; session: RowSession }) {
  const { t } = useTranslation('sessions')
  // Main's link alone, so the row names the Ticket the list files it under.
  const ticketKey = session.ticket?.key ?? null
  const minutes = sessionAge(session, now)
  const plan = session.plan ?? null
  // The line keeps its height when empty, so a row does not shrink as its age hides.
  return (
    <span className="mt-1 flex min-h-lh items-center gap-2 type-meta text-faint [&_svg]:size-(--size-icon-metadata)">
      {minutes === null || session.updatedAt === null ? null : (
        <SessionAge minutes={minutes} updatedAt={session.updatedAt} />
      )}
      {plan === null ? null : <SessionPlanBar plan={plan} running={session.status === 'running'} />}
      {session.planProgress === null ? null : (
        <span>
          {t('composer.plan', {
            current: session.planProgress.completed,
            total: session.planProgress.total,
          })}
        </span>
      )}
      {ticketKey !== null ? (
        <span className="inline-flex items-center gap-1">
          <Icon name="ticket" />
          <span>{ticketKey}</span>
        </span>
      ) : null}
      {session.subagents.length > 0 ? (
        <span className="inline-flex items-center gap-1">
          <Icon name="agent" />
          <span>{session.subagents.length}</span>
        </span>
      ) : null}
    </span>
  )
}

// Memoized with boolean props: a running Session rebuilds the list several times a second.
// The list's one context menu finds this row by `data-session-id` (session-list.tsx).
export const SessionRow = memo(function SessionRow({
  checked,
  now,
  onFocus,
  onSelect,
  onToggleSelect,
  selected,
  session,
  tabbable,
  unavailable,
}: {
  checked: boolean
  now: number
  onFocus: (sessionId: SessionId) => void
  onSelect: (sessionId: SessionId) => void
  onToggleSelect: (sessionId: SessionId, modifier: SelectionModifier) => void
  selected: boolean
  session: RowSession
  tabbable: boolean
  unavailable: boolean
}) {
  const { t } = useTranslation('sessions')
  const [pointerFocused, setPointerFocused] = useState(false)
  const { archived } = session
  const rowHighlight = rowHighlightOf(checked, selected, archived)
  const focusHighlight = pointerFocused
    ? 'focus-visible:outline-2 focus-visible:outline-transparent focus-visible:ring-0'
    : 'focus-visible:ring-2 focus-visible:ring-ring'
  const statusVariant = unavailable ? 'failed' : STATUS_VARIANTS[session.status]
  // A modifier click selects instead of opening; an archived row takes no part in a bulk selection.
  function handleRowClick(event: MouseEvent) {
    const modifier = archived ? 'plain' : selectionModifierOf(event)
    if (modifier === 'plain') onSelect(session.id)
    else onToggleSelect(session.id, modifier)
  }
  return (
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
      <SessionRowMark session={session} unavailable={unavailable} />
      {/* The status dot's colour, in words for a reader it never reaches. */}
      {unavailable ? null : (
        <span className="sr-only">{t(`events.liveStatus.${session.status}`)}</span>
      )}
      {checked ? <span className="sr-only">{t('bulkSelect.selected')}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="block min-w-0 truncate type-body font-medium text-foreground">
            <SessionTitle session={session} text={session.name} />
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
          {statusVariant === 'attention' ? (
            <Badge size="compact" variant="warning">
              {t('needsInput')}
            </Badge>
          ) : null}
        </span>
        <ActivityLine session={session} />
        <SessionMetadata now={now} session={session} />
      </span>
    </button>
  )
})

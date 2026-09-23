import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/platform/renderer/components/icon/icon'
import type { Session } from '../../types'
import { ticketKeyForSession } from '../ticket-link/ticket-key-for-session'
import { sessionTiming } from './session-timing'

function planStepTone(session: Session, step: number) {
  if (session.plan?.state !== 'available') return 'bg-border'
  const completed = session.plan.entries.filter((entry) => entry.status === 'completed').length
  if (step < completed) {
    return session.status === 'running' ? 'bg-foreground/70' : 'bg-muted-foreground/50'
  }
  if (step === completed && session.status === 'running') return 'bg-foreground'
  return 'bg-border'
}

function SessionPlanBar({ session }: { session: Session }) {
  const { t } = useTranslation('sessions')
  if (session.plan?.state !== 'available') return null
  const completed = session.plan.entries.filter((entry) => entry.status === 'completed').length
  return (
    <span
      aria-label={t('roster.planProgress', { completed, total: session.plan.entries.length })}
      className="flex h-(--size-plan-bar) w-16 shrink-0 gap-px"
      role="img"
    >
      {session.plan.entries.map((entry, step) => (
        <span
          className={`min-w-0 flex-1 rounded-full ${planStepTone(session, step)}`}
          key={entry.position}
        />
      ))}
    </span>
  )
}

type SessionTimingValue = NonNullable<ReturnType<typeof sessionTiming>>

function SessionTiming({ timing }: { timing: SessionTimingValue }) {
  return (
    <time
      className="inline-flex shrink-0 tabular-nums"
      dateTime={timing.dateTime}
      title={timing.label}
    >
      {timing.text}
    </time>
  )
}

export function SessionMetadata({ session }: { session: Session }) {
  const { t } = useTranslation('sessions')
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  const timing = sessionTiming(session, now)
  const ticketKey = ticketKeyForSession(session)
  const hasMetadata =
    session.plan?.state === 'available' ||
    session.plan?.state === 'malformed' ||
    session.subagents.length > 0 ||
    session.pullRequest !== null ||
    ticketKey !== null ||
    timing !== null
  if (!hasMetadata) return null
  return (
    <span className="mt-1 flex items-center gap-2 type-meta text-faint [&_svg]:size-(--size-icon-metadata)">
      {timing === null ? null : <SessionTiming timing={timing} />}
      <SessionPlanBar session={session} />
      {session.plan?.state === 'malformed' ? <span>{t('roster.planUnreadable')}</span> : null}
      {ticketKey !== null ? (
        <span className="inline-flex items-center gap-1">
          <Icon name="ticket" />
          <span>{ticketKey}</span>
        </span>
      ) : null}
      {session.pullRequest !== null ? (
        <span className="inline-flex" data-slot="session-pull-request">
          <Icon name="pull-request-linked" />
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

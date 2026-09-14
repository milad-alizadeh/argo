import type { Session } from '../types'

type TimingSource = 'turnStartedAt' | 'updatedAt'

const TIMING_BY_STATUS: Record<
  Session['status'],
  { label: string; source: TimingSource; style: 'elapsed' | 'recency' }
> = {
  asking: { label: 'Asking', source: 'turnStartedAt', style: 'elapsed' },
  ended: { label: 'Updated', source: 'updatedAt', style: 'recency' },
  idle: { label: 'Updated', source: 'updatedAt', style: 'recency' },
  permission: { label: 'Waiting', source: 'turnStartedAt', style: 'elapsed' },
  running: { label: 'Running', source: 'turnStartedAt', style: 'elapsed' },
  starting: { label: 'Starting', source: 'turnStartedAt', style: 'elapsed' },
  stopped: { label: 'Updated', source: 'updatedAt', style: 'recency' },
  unknown: { label: 'Updated', source: 'updatedAt', style: 'recency' },
}

function elapsedMinutes(timestamp: string, now: number) {
  const startedAt = Date.parse(timestamp)
  if (Number.isNaN(startedAt)) return null
  return Math.max(0, Math.floor((now - startedAt) / 60_000))
}

function compactDuration(minutes: number) {
  if (minutes < 1) return '<1m'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export function sessionTiming(session: Session, now: number) {
  const timing = TIMING_BY_STATUS[session.status]
  const timestamp = session[timing.source]
  if (timestamp === null) return null
  const minutes = elapsedMinutes(timestamp, now)
  if (minutes === null) return null
  const duration = compactDuration(minutes)
  if (timing.style === 'elapsed') {
    return { dateTime: timestamp, label: `${timing.label} ${duration}`, text: duration }
  }
  return {
    dateTime: timestamp,
    label: minutes < 1 ? 'Updated just now' : `Updated ${duration} ago`,
    text: duration,
  }
}

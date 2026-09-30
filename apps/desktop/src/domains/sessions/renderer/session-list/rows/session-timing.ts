import type { Session } from '../../types'

// A settled Session shows how long ago it last changed; a working one shows no time.
const SHOWS_RECENCY: Record<Session['status'], boolean> = {
  asking: false,
  ended: true,
  idle: true,
  permission: false,
  running: false,
  starting: false,
  stopped: true,
  unknown: true,
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
  const timestamp = session.updatedAt
  if (!SHOWS_RECENCY[session.status] || timestamp === null) return null
  const minutes = elapsedMinutes(timestamp, now)
  if (minutes === null) return null
  const duration = compactDuration(minutes)
  return {
    dateTime: timestamp,
    label: minutes < 1 ? 'Updated just now' : `Updated ${duration} ago`,
    text: duration,
  }
}

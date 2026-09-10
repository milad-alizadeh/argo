import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { compactAge, turnDuration } from '../../../../core/sessions/clock'
import { isLive } from '../../../../core/sessions/delegation'
import type { Session } from '../types'

// A live Turn is read to the second, so it ticks every second. An age is read to the minute at
// its finest, so a slower tick keeps it true without redrawing every row every second.
const LIVE_TICK = 1000
const AGE_TICK = 30_000

function useNow(interval: number): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), interval)
    return () => clearInterval(timer)
  }, [interval])
  return now
}

function since(stamp: string | null, now: number): number | null {
  if (stamp === null) return null
  const at = Date.parse(stamp)
  return Number.isNaN(at) ? null : now - at
}

// Line 3's clock (`cockpit-roster-row.html`): how long the open Turn has run while the Session is
// live, in the running ink while it is working rather than waiting on the reader; and otherwise
// how long ago the Session last wrote. An age Argo cannot place state with a word is said to be
// an age, so it is never read as a Turn that took that long. A Session with no time on any record
// draws no clock (CONTEXT.md L1 · degrade down).
export function SessionClock({ session }: { session: Session }) {
  const { t } = useTranslation()
  const live = isLive(session.status) && session.turnStartedAt !== null
  const now = useNow(live ? LIVE_TICK : AGE_TICK)
  const working = session.status === 'starting' || session.status === 'running'

  const turn = live ? since(session.turnStartedAt, now) : null
  if (turn !== null) {
    return (
      <span
        className={`roster__clock flex-none font-mono text-meta tabular-nums ${working ? 'text-active' : 'text-faint'}`}
      >
        {turnDuration(turn)}
      </span>
    )
  }
  const age = since(session.updatedAt, now)
  if (age === null) return null
  const text = compactAge(age)
  return (
    <span className="roster__clock flex-none font-mono text-meta text-faint">
      {session.status === 'unknown' ? t('row.ago', { age: text }) : text}
    </span>
  )
}

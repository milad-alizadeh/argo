import type { SessionStatus, SessionView } from '@shared'
import type { RosterTone } from '@/shared/delivery'

// The project-strip roll-up: ONE dot per project for the sessions you cannot see. The
// ranking is the attention registry's — `needs you` outranks `failed` outranks `running` —
// and everything else earns no dot at all, because a badge nobody can clear is noise.

const RANKED: readonly { status: SessionStatus; tone: RosterTone }[] = [
  { status: 'needs-input', tone: 'amber' },
  { status: 'failed', tone: 'red' },
  { status: 'running', tone: 'run' },
]

/** The one dot a project tab carries, or null when its sessions want nothing from you. */
export function worstStateDot(sessions: SessionView[], projectId: string): RosterTone | null {
  const mine = sessions.filter((session) => session.projectId === projectId)
  return (
    RANKED.find((rank) => mine.some((session) => session.facts.status === rank.status))?.tone ??
    null
  )
}

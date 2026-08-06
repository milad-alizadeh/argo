import type { ComponentProps } from 'react'
import { buildSessionsRoomModel, type SessionScreen } from '@/rooms/sessions/components'
import { useSessionStore } from '../projection/sessionStore'
import type { ShellState } from '../shell/useShellState'
import { useSessionInterior } from './useSessionInterior'

// Everything the Sessions room needs, assembled in one place. The room is a pure View, so the
// store read, the roster filter and the interior's own UI state all live on this side of the
// seam, and the container does nothing but hand the result over.

/** The two acts the shell owns that the room raises: spawning, and why a spawn was refused. */
export interface SessionsRoomSpawn {
  spawnSession: () => void
  spawnRefusal: string | null
}

export function useSessionsRoom(
  shell: ShellState,
  spawn: SessionsRoomSpawn,
): ComponentProps<typeof SessionScreen> {
  const sessions = useSessionStore((store) => store.sessions)
  const activeProjectId = useSessionStore((store) => store.activeProjectId)

  // The roster is the ACTIVE project's. A Session belongs to the Project its cwd sits in
  // (ADR-0015), so showing every project's sessions beside a per-project strip dot would be two
  // surfaces disagreeing about the same world. A Session inside no Project is nobody's.
  const roster = sessions.filter((session) => session.projectId === activeProjectId)
  const session = useSessionInterior(
    roster.find((candidate) => candidate.id === shell.selectedSessionId) ?? null,
  )

  return {
    roster: buildSessionsRoomModel({ sessions: roster, selectedId: shell.selectedSessionId }),
    interior: session.interior,
    layout: session.layout,
    attach: session.attach,
    spawnRefusal: spawn.spawnRefusal,
    handlers: {
      ...session.handlers,
      onSelectSession: shell.selectSession,
      onSpawnSession: spawn.spawnSession,
    },
  }
}

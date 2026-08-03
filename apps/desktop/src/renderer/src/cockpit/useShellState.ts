import { useCallback, useState } from 'react'
import {
  DEFAULT_PROJECT_UI,
  nextProjectId,
  type ProjectUi,
  type ProjectUiMemory,
  type Room,
  recallProjectUi,
  rememberProjectUi,
} from '@/shell/components'
import { useSessionStore } from './sessionStore'

// The shell's own UI state, which is what makes a project swap a VIEW CHANGE: the room and
// selection you left a project in are filed under its id and handed back on return. Nothing is
// torn down — main keeps every session running and never learns that the view moved.

export interface ShellState extends ProjectUi {
  selectRoom: (room: Room) => void
  selectSession: (sessionId: string | null) => void
  swapProject: (projectId: string) => void
  /** Where `⌘[` / `⌘]` land, in the strip's own order. */
  stepProject: (step: -1 | 1) => void
}

export function useShellState(): ShellState {
  const projects = useSessionStore((state) => state.projects)
  const activeId = useSessionStore((state) => state.activeProjectId)
  const [ui, setUi] = useState<ProjectUi>(DEFAULT_PROJECT_UI)
  const [memory, setMemory] = useState<ProjectUiMemory>({})

  const swapProject = useCallback(
    (projectId: string) => {
      if (projectId === activeId) return
      const kept = activeId === null ? memory : rememberProjectUi(memory, activeId, ui)
      setMemory(kept)
      setUi(recallProjectUi(kept, projectId))
      void window.cockpit?.activateProject(projectId)
    },
    [activeId, memory, ui],
  )

  const stepProject = useCallback(
    (step: -1 | 1) => {
      const next = nextProjectId(
        projects.map((project) => project.id),
        activeId,
        step,
      )
      if (next !== null) swapProject(next)
    },
    [activeId, projects, swapProject],
  )

  return {
    ...ui,
    selectRoom: (room) => setUi((state) => ({ ...state, room })),
    selectSession: (selectedSessionId) => setUi((state) => ({ ...state, selectedSessionId })),
    swapProject,
    stepProject,
  }
}

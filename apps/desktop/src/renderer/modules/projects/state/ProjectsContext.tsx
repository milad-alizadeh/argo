// One reading of the Project surface for the whole window, so the switcher and a room that needs
// the selected Project are never two answers to the same question.
import { createContext, type ReactNode, use } from 'react'
import type { ProjectSummary } from '@/core/projects/messages'
import { type Cockpit, type ProjectActions, useProjects } from '../hooks/useProjects'

const ProjectsContext = createContext<[Cockpit, ProjectActions] | null>(null)

export function ProjectsProvider({ children }: { children: ReactNode }) {
  return <ProjectsContext value={useProjects()}>{children}</ProjectsContext>
}

export function useProjectsContext(): [Cockpit, ProjectActions] {
  const value = use(ProjectsContext)
  if (!value) throw new Error('useProjectsContext needs a ProjectsProvider')
  return value
}

// Only a Project that opened is selected: a refused one has no folder to read Tickets for.
export function useSelectedProject(): ProjectSummary | null {
  const [cockpit] = useProjectsContext()
  return cockpit.status === 'selected' ? cockpit.project : null
}

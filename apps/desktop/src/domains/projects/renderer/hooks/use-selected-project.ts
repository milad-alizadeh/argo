import { type ProjectSummary, useProjects } from './use-projects'

// Only a Project that opened is selected: a refused one has no folder to read Tickets for.
export function useSelectedProject(): ProjectSummary | null {
  const [projectState] = useProjects()
  return projectState.status === 'selected' ? projectState.project : null
}

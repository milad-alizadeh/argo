import type { ProjectSummary } from '@/core/projects/messages'
import { useProjects } from './use-projects'

// Only a Project that opened is selected: a refused one has no folder to read Tickets for.
export function useSelectedProject(): ProjectSummary | null {
  const [cockpit] = useProjects()
  return cockpit.status === 'selected' ? cockpit.project : null
}

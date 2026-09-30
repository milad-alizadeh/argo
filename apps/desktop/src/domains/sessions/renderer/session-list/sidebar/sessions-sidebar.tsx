import { useParams } from 'react-router'
import { useProjects } from '@/domains/projects/renderer'
import { SessionList } from '../session-list'
import { useSidebarActions } from './use-sidebar-actions'

// Navigates under a stored ID even when no loaded row carries it; the Session reader resolves it.
export function SessionsSidebar() {
  const { sessionId } = useParams()
  const [cockpit] = useProjects()
  const projectId = cockpit.project?.id ?? null
  return (
    <SessionList
      actions={useSidebarActions(projectId)}
      projectId={projectId}
      selectedSessionId={sessionId ?? null}
    />
  )
}

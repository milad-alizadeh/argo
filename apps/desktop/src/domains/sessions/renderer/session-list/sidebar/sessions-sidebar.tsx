import { useParams } from 'react-router'
import { useProjects } from '@/domains/projects/renderer'
import { SessionList, type SessionListActions } from '../session-list'
import { useArchiveSelected } from './use-session-archive-mutation'
import { useSidebarActions } from './use-sidebar-actions'

// Navigates under a stored ID even when no loaded row carries it; the Session reader resolves it.
export function SessionsSidebar() {
  const { sessionId } = useParams()
  const [cockpit] = useProjects()
  const projectId = cockpit.project?.id ?? null
  const archiveSelected = useArchiveSelected()
  const sidebarActions = useSidebarActions()

  const actions: SessionListActions = {
    onArchiveSelected: archiveSelected,
    onNew: sidebarActions.openNew,
    onOpenTicket: sidebarActions.openTicket,
    onRename: sidebarActions.rename,
    onSelect: sidebarActions.select,
  }

  return (
    <SessionList actions={actions} projectId={projectId} selectedSessionId={sessionId ?? null} />
  )
}

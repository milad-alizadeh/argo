import { useParams } from 'react-router'
import { useProjects } from '@/domains/projects/renderer'
import { SessionList, type SessionListActions } from '../session-list'
import { useArchiveSelected } from './use-session-archive-mutation'
import { useSidebarActions } from './use-sidebar-actions'

// A stored id absent from the active SessionList is not necessarily gone: the active list never
// carries an archived Session, so this can still be one, restored by the Archive section
// asking the reader for it by id (#1593). Navigate under the stored id either way; only a
// Session the reader answers for nowhere at all fails to resolve, same as any stale id.
export function SessionsSidebar() {
  const { sessionId } = useParams()
  const [cockpit] = useProjects()
  const projectRoot = cockpit.project?.path ?? null
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
    <SessionList
      actions={actions}
      projectRoot={projectRoot}
      selectedSessionId={sessionId ?? null}
    />
  )
}

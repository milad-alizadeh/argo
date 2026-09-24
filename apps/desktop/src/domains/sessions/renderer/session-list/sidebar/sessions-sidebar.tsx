import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useProjects } from '@/domains/projects/renderer'
import { SessionList } from '../session-list'
import { SELECTED_SESSION_KEY, useSidebarActions } from './use-sidebar-actions'

function useRestoreSelectedSession({
  sessionId,
  navigate,
}: {
  sessionId: string | undefined
  navigate: ReturnType<typeof useNavigate>
}) {
  useEffect(() => {
    if (sessionId !== undefined) return
    const storedId = window.localStorage.getItem(SELECTED_SESSION_KEY)
    if (storedId === null) return
    navigate(`/sessions/${storedId}`, { replace: true })
  }, [navigate, sessionId])
}

export function SessionsSidebar() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [cockpit] = useProjects()
  const projectRoot = cockpit.project?.path ?? null
  const sidebarActions = useSidebarActions({
    projectPath: projectRoot,
  })
  useRestoreSelectedSession({ sessionId, navigate })

  const actions = {
    onNew: sidebarActions.openNew,
    onSelect: sidebarActions.select,
  }

  return (
    <SessionList
      actions={actions}
      projectId={cockpit.project?.id ?? null}
      selectedSessionId={sessionId ?? null}
    />
  )
}

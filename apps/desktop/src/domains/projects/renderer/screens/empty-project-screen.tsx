import { useNavigate } from 'react-router'
import { EmptyProjectWindow } from '@/domains/projects/renderer/components/empty-project-window'
import { useProjects } from '@/domains/projects/renderer/port'
import { useCommands } from '@/platform/renderer/cockpit/hooks/use-commands'
import { REGISTER_PROJECT_COMMAND } from '@/platform/shared/commands'

// The switcher that answers the add-Project chord is not mounted here, so this window answers it.
export function EmptyProjectScreen() {
  const [cockpit] = useProjects()
  const navigate = useNavigate()
  useCommands((command) => {
    if (command === REGISTER_PROJECT_COMMAND) navigate('/projects/new')
  })
  return <EmptyProjectWindow busy={cockpit.busy} onAdd={() => navigate('/projects/new')} />
}

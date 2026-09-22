import { REGISTER_PROJECT_COMMAND } from '@/platform/contract/commands'
import { useCommands } from '@/platform/renderer/cockpit/hooks/use-commands'
import { EmptyProjectWindow } from '../components/empty-project-window'
import { useProjects } from '../hooks/use-projects'

// The switcher that answers the add-Project chord is not mounted here, so this window answers it.
export function EmptyProjectScreen() {
  const [cockpit, actions] = useProjects()
  useCommands((command) => {
    if (command === REGISTER_PROJECT_COMMAND) actions.open()
  })
  return <EmptyProjectWindow busy={cockpit.busy} onAdd={actions.open} />
}

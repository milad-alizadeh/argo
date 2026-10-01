import { REGISTER_PROJECT_COMMAND } from '@/platform/contract/commands'
import { useCommands } from '@/platform/renderer/shell/hooks/use-commands'
import { EmptyProjectWindow } from '../components'
import { useProjects } from '../hooks'

// The switcher that answers the add-Project chord is not mounted here, so this window answers it.
export function EmptyProjectScreen() {
  const [projectState, actions] = useProjects()
  useCommands((command) => {
    if (command === REGISTER_PROJECT_COMMAND) actions.open()
  })
  return <EmptyProjectWindow busy={projectState.busy} onAdd={actions.open} />
}

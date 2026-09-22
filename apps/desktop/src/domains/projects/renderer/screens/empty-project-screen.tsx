import { EmptyProjectWindow } from '@/domains/projects/renderer/components/empty-project-window'
import { useProjects } from '@/domains/projects/renderer/port'
import { useCommands } from '@/platform/renderer/cockpit/hooks/use-commands'
import { REGISTER_PROJECT_COMMAND } from '@/platform/contract/commands'

// The switcher that answers the add-Project chord is not mounted here, so this window answers it.
export function EmptyProjectScreen() {
  const [cockpit, actions] = useProjects()
  useCommands((command) => {
    if (command === REGISTER_PROJECT_COMMAND) actions.open()
  })
  return <EmptyProjectWindow busy={cockpit.busy} onAdd={actions.open} />
}

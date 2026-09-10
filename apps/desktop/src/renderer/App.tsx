// The cockpit. One Project is open at a time, and the surfaces beside it are reached from the
// sidebar, the menu, or the window chords, all three reading one shortcut table (#1786).
import { useCallback, useState } from 'react'
import {
  DESTINATIONS,
  type Destination,
  navigateCommand,
  REGISTER_PROJECT_COMMAND,
} from '../shortcuts'
import { AppearanceControl } from './components/AppearanceControl'
import { ChromeBar } from './components/ChromeBar'
import { CockpitShell } from './components/CockpitShell'
import { ProjectDeck } from './components/ProjectDeck'
import { Sidebar } from './components/Sidebar'
import { useAppearance } from './hooks/useAppearance'
import { useCommands } from './hooks/useCommands'
import { type Cockpit, useProjects } from './hooks/useProjects'

function subject(cockpit: Cockpit): string {
  return cockpit.project ? `— ${cockpit.project.name}` : '— no Project open'
}

export function App() {
  const [appearance, chooseAppearance] = useAppearance()
  const [cockpit, actions] = useProjects()
  const [destination, setDestination] = useState<Destination>('Projects')

  useCommands(
    useCallback(
      (command: string) => {
        if (command === REGISTER_PROJECT_COMMAND) {
          actions.open()
          return
        }
        const chosen = DESTINATIONS.find((candidate) => navigateCommand(candidate) === command)
        if (chosen) setDestination(chosen)
      },
      [actions],
    ),
  )

  return (
    <CockpitShell
      chrome={
        <ChromeBar subject={subject(cockpit)}>
          <AppearanceControl appearance={appearance} onChange={chooseAppearance} />
        </ChromeBar>
      }
      sidebar={<Sidebar destination={destination} onNavigate={setDestination} />}
      deck={<ProjectDeck destination={destination} cockpit={cockpit} actions={actions} />}
    />
  )
}

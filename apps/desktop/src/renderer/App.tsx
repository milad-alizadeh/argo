// The cockpit. One Project is open at a time, and the surfaces beside it are reached from the
// sidebar, the menu, or the window chords, all three reading one shortcut table (#1786).
import { useCallback, useEffect, useState } from 'react'
import {
  DESTINATIONS,
  type Destination,
  navigateCommand,
  REGISTER_PROJECT_COMMAND,
} from '../core/commands/shortcuts'
import { AppearanceControl } from './modules/appearance/components/AppearanceControl'
import { useAppearance } from './modules/appearance/hooks/useAppearance'
import { ChromeBar } from './modules/cockpit/components/ChromeBar'
import { CockpitShell } from './modules/cockpit/components/CockpitShell'
import { Sidebar } from './modules/cockpit/components/Sidebar'
import { useCommands } from './modules/cockpit/hooks/useCommands'
import { ProjectDeck } from './modules/projects/components/ProjectDeck'
import { type Cockpit, useProjects } from './modules/projects/hooks/useProjects'
import './i18n/config'

function destinationFromHash(): Destination {
  const path = window.location.hash.slice(1)
  return DESTINATIONS.find((candidate) => path === `/${candidate.toLowerCase()}`) ?? 'Projects'
}

function destinationHash(destination: Destination): string {
  return `#/${destination.toLowerCase()}`
}

function subject(cockpit: Cockpit): string {
  return cockpit.project ? `— ${cockpit.project.name}` : '— no Project open'
}

export function App() {
  const [appearance, chooseAppearance] = useAppearance()
  const [cockpit, actions] = useProjects()
  const [destination, setDestination] = useState(destinationFromHash)
  const navigate = useCallback((nextDestination: Destination) => {
    window.location.hash = destinationHash(nextDestination)
    setDestination(nextDestination)
  }, [])

  useEffect(() => {
    if (!window.location.hash) window.location.hash = destinationHash(destination)
    const updateDestination = () => setDestination(destinationFromHash())
    window.addEventListener('hashchange', updateDestination)
    return () => window.removeEventListener('hashchange', updateDestination)
  }, [destination])

  useCommands(
    useCallback(
      (command: string) => {
        if (command === REGISTER_PROJECT_COMMAND) {
          actions.open()
          return
        }
        const chosen = DESTINATIONS.find((candidate) => navigateCommand(candidate) === command)
        if (chosen) navigate(chosen)
      },
      [actions, navigate],
    ),
  )

  return (
    <CockpitShell
      chrome={
        <ChromeBar subject={subject(cockpit)}>
          <AppearanceControl appearance={appearance} onChange={chooseAppearance} />
        </ChromeBar>
      }
      sidebar={<Sidebar destination={destination} onNavigate={navigate} />}
      deck={<ProjectDeck destination={destination} cockpit={cockpit} actions={actions} />}
    />
  )
}

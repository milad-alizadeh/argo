// The cockpit. One Project is open at a time, and the surfaces beside it are reached from the
// sidebar, the menu, or the window chords, all three reading one shortcut table (#1786).
import { useCallback, useEffect, useState } from 'react'
import {
  DESTINATIONS,
  type Destination,
  IMPORT_PROJECTS_COMMAND,
  navigateCommand,
  REGISTER_PROJECT_COMMAND,
} from '../core/commands/shortcuts'
import { useAppearance } from './modules/appearance/hooks/useAppearance'
import { CockpitSurface } from './modules/cockpit/components/CockpitSurface'
import { useCommands } from './modules/cockpit/hooks/useCommands'
import { useProjects } from './modules/projects/hooks/useProjects'
import './i18n/config'

function destinationFromHash(): Destination {
  const path = window.location.hash.slice(1)
  return DESTINATIONS.find((candidate) => path === `/${candidate.toLowerCase()}`) ?? 'Sessions'
}

function destinationHash(destination: Destination): string {
  return `#/${destination.toLowerCase()}`
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
        if (command === IMPORT_PROJECTS_COMMAND) {
          actions.import()
          return
        }
        const chosen = DESTINATIONS.find((candidate) => navigateCommand(candidate) === command)
        if (chosen) navigate(chosen)
      },
      [actions, navigate],
    ),
  )

  return (
    <CockpitSurface
      actions={actions}
      appearance={appearance}
      chooseAppearance={chooseAppearance}
      cockpit={cockpit}
      destination={destination}
      navigate={navigate}
    />
  )
}

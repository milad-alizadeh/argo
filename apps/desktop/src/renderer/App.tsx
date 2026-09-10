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
import { ComposerPrototype } from './modules/composer-prototype/ComposerPrototype'
import { ProjectDeck } from './modules/projects/components/ProjectDeck'
import { ProjectRefusal } from './modules/projects/components/ProjectRefusal'
import { type Cockpit, useProjects } from './modules/projects/hooks/useProjects'
import './i18n/config'

function destinationFromHash(): Destination {
  const path = window.location.hash.slice(1)
  return DESTINATIONS.find((candidate) => path === `/${candidate.toLowerCase()}`) ?? 'Sessions'
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
  const showsComposerPrototype =
    (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env
      .VITE_COMPOSER_PROTOTYPE === '1'
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

  // A Project is the window's subject, so until one is open there is no sidebar: nothing is yet
  // there for a surface to be about, and the deck takes the window. A folder turned away while a
  // Project is open leaves that Project standing, so its refusal has nowhere in the deck to land
  // and takes a band of its own above the surfaces.
  const open = cockpit.status === 'selected'
  return (
    <CockpitShell
      chrome={
        <ChromeBar subject={subject(cockpit)}>
          <AppearanceControl appearance={appearance} onChange={chooseAppearance} />
        </ChromeBar>
      }
      notice={open && cockpit.message ? <ProjectRefusal message={cockpit.message} /> : undefined}
      sidebar={open ? <Sidebar destination={destination} onNavigate={navigate} /> : undefined}
      deck={
        showsComposerPrototype ? (
          <ComposerPrototype />
        ) : (
          <ProjectDeck destination={destination} cockpit={cockpit} actions={actions} />
        )
      }
    />
  )
}

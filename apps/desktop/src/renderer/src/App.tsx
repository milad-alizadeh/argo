import { useCallback, useEffect } from 'react'
import { CockpitScreenView } from '@/CockpitScreenView'
import {
  RoomStage,
  useConnectPanel,
  useGitGroup,
  useSessionStore,
  useSessionsRoom,
  useShellCommands,
  useShellState,
} from '@/cockpit'
import { SessionScreen } from '@/rooms/sessions/components'
import { buildShellModel } from '@/shell/components'

// Container: wires the projection bridge into the store, then renders the chrome and the active
// room as pure Views of it (ADR-0005). All business logic lives in main; the only things derived
// here are the shell's own projections — the strip's dots, the git menu's refusals — and each is
// a pure function tested away from the DOM.
function App(): React.JSX.Element {
  // Selectors rather than the whole store: a projection delta must not re-render the chrome and
  // both rooms, which is the difference the low-spec target notices.
  const sessions = useSessionStore((store) => store.sessions)
  const projects = useSessionStore((store) => store.projects)
  const activeProjectId = useSessionStore((store) => store.activeProjectId)
  const grant = useSessionStore((store) => store.grant)
  const applyDelta = useSessionStore((store) => store.applyDelta)
  const shell = useShellState()
  // Onboarding IS creating a Project (ADR-0015), so the panel that adds one and the panel
  // Project Settings opens are the same surface, wired once here.
  const connect = useConnectPanel()
  const commands = useShellCommands(shell)

  useEffect(() => window.cockpit?.subscribeProjection(applyDelta), [applyDelta])

  const openSession = useCallback(
    (sessionId: string) => {
      shell.selectRoom('sessions')
      shell.selectSession(sessionId)
    },
    [shell],
  )
  const git = useGitGroup({
    onOpenSession: openSession,
    onOpenScratchTerminal: commands.openScratchTerminal,
    onResolveWithAgent: commands.resolveWithAgent,
  })
  const sessionsRoom = useSessionsRoom(shell, commands)

  return (
    <CockpitScreenView
      shell={buildShellModel({ projects, activeProjectId, sessions })}
      room={shell.room}
      // The Concierge is a seat only: no live signal reaches it until the voice map lands, and a
      // fabricated caption would be the shell claiming to have heard something.
      caption={null}
      git={git}
      connect={connect.panel}
      connectHandlers={connect.handlers}
      grant={grant}
      handlers={{
        onSelectProject: shell.swapProject,
        onAddProject: connect.startOnboarding,
        onSelectRoom: shell.selectRoom,
        onConnect: connect.startOnboarding,
        onOpenSettings: connect.openSettings,
        onReconnectGrant: connect.reconnect,
      }}
    >
      <RoomStage room={shell.room} sessions={<SessionScreen {...sessionsRoom} />} />
    </CockpitScreenView>
  )
}

export default App

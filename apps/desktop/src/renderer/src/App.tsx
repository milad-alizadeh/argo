import { useCallback, useEffect } from 'react'
import { CockpitScreen } from '@/CockpitScreen'
import { RoomStage } from '@/RoomStage'
import { SessionScreen } from '@/SessionScreen'
import { useSessionStore } from '@/sessionStore'
import { buildShellModel } from '@/shell/components'
import { useGitGroup } from '@/useGitGroup'
import { useSessionPanel } from '@/useSessionPanel'
import { useShellCommands } from '@/useShellCommands'
import { useShellState } from '@/useShellState'

// Container: wires the projection bridge into the store, then renders the chrome and the active
// room as pure Views of it (ADR-0005). All business logic lives in main; the only things derived
// here are the shell's own projections — the strip's dots, the git menu's refusals — and each is
// a pure function tested away from the DOM.
function App(): React.JSX.Element {
  const state = useSessionStore()
  const applyDelta = useSessionStore((store) => store.applyDelta)
  const shell = useShellState()
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
  const panel = useSessionPanel(
    state.sessions.find((session) => session.id === shell.selectedSessionId) ?? null,
  )

  return (
    <CockpitScreen
      shell={buildShellModel(state)}
      room={shell.room}
      // The Concierge is a seat only: no live signal reaches it until the voice map lands, and a
      // fabricated caption would be the shell claiming to have heard something.
      caption={null}
      // `last synced` has no observed fact yet (it arrives with the connection roll-up), so the
      // tab tooltip shows the project's name alone rather than inventing an age.
      lastSynced={null}
      git={git}
      handlers={{
        onSelectProject: shell.swapProject,
        onAddProject: commands.addProject,
        onOpenProjectMenu: commands.openProjectMenu,
        onSelectRoom: shell.selectRoom,
        onConnect: commands.addProject,
      }}
    >
      <RoomStage
        room={shell.room}
        sessions={
          <SessionScreen
            sessions={state.sessions}
            selectedId={shell.selectedSessionId}
            panel={panel.panel}
            layout={panel.layout}
            handlers={{
              ...panel.handlers,
              onSelectSession: shell.selectSession,
              onCloseSession: () => shell.selectSession(null),
            }}
            orbState="idle"
          />
        }
      />
    </CockpitScreen>
  )
}

export default App

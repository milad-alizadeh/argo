import { useCallback, useEffect } from 'react'
import { CockpitScreenView } from '@/CockpitScreenView'
import { RoomStage, useGitGroup, useSessionPanel, useShellCommands, useShellState } from '@/cockpit'
import { SessionScreen } from '@/SessionScreen'
import { useSessionStore } from '@/sessionStore'
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

  // The roster is the ACTIVE project's. A Session belongs to the Project its cwd sits in
  // (ADR-0015), so showing every project's sessions beside a per-project strip dot would be two
  // surfaces disagreeing about the same world. A Session inside no Project is nobody's.
  const roster = sessions.filter((session) => session.projectId === activeProjectId)
  const panel = useSessionPanel(
    roster.find((session) => session.id === shell.selectedSessionId) ?? null,
  )

  return (
    <CockpitScreenView
      shell={buildShellModel({ projects, activeProjectId, sessions })}
      room={shell.room}
      // The Concierge is a seat only: no live signal reaches it until the voice map lands, and a
      // fabricated caption would be the shell claiming to have heard something.
      caption={null}
      git={git}
      handlers={{
        onSelectProject: shell.swapProject,
        onAddProject: commands.addProject,
        onSelectRoom: shell.selectRoom,
        onConnect: commands.addProject,
      }}
    >
      <RoomStage
        room={shell.room}
        sessions={
          <SessionScreen
            sessions={roster}
            selectedId={shell.selectedSessionId}
            panel={panel.panel}
            layout={panel.layout}
            handlers={{
              ...panel.handlers,
              onSelectSession: shell.selectSession,
              onCloseSession: () => shell.selectSession(null),
              onSpawnSession: commands.spawnSession,
            }}
            orbState="idle"
          />
        }
      />
    </CockpitScreenView>
  )
}

export default App

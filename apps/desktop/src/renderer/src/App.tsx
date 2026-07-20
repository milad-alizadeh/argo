import { useEffect } from 'react'
import { Rail } from '@/domains/rail/components'
import { useSessionStore } from '@/sessionStore'

// Container: wires the projection bridge into the store, then renders the rail as a
// pure projection of that state (ADR-0005). All business logic lives in main; this
// only subscribes and hands `sessions` to the View.
function App(): React.JSX.Element {
  const sessions = useSessionStore((state) => state.sessions)
  const applyDelta = useSessionStore((state) => state.applyDelta)

  useEffect(() => window.cockpit?.subscribeProjection(applyDelta), [applyDelta])

  return <Rail sessions={sessions} />
}

export default App

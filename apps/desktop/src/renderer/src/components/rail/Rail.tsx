import type { SessionView } from '@/sessionStore'
import { EmptyRail } from './EmptyRail'
import { SessionRow } from './SessionRow'

// Organism: the rail of observed Sessions, a pure projection of `sessions`. An empty
// roster renders the empty state; otherwise one row per Session.
export function Rail({ sessions }: { sessions: SessionView[] }): React.JSX.Element {
  return (
    <main data-testid="cockpit-root" className="flex h-screen w-screen flex-col bg-background">
      {sessions.length === 0 ? (
        <EmptyRail />
      ) : (
        <ul aria-label="Sessions" className="flex flex-col gap-1 p-3">
          {sessions.map((session) => (
            <SessionRow key={session.id} session={session} />
          ))}
        </ul>
      )}
    </main>
  )
}

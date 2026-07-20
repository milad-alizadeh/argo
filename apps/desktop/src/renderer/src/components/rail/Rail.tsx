import { Text } from '@/components/ui'
import type { SessionView } from '@/sessionStore'
import { EmptyRail } from './EmptyRail'
import { SessionRow } from './SessionRow'

// Organism: the rail of observed Sessions — one frosted `panel` holding flat inset
// rows, a pure projection of `sessions`. An empty roster renders the empty state.
// This is the whole window for now; later tickets add the session-detail column beside it.
export function Rail({ sessions }: { sessions: SessionView[] }): React.JSX.Element {
  return (
    <main
      data-testid="cockpit-root"
      className="flex h-screen w-screen bg-background p-3 text-foreground"
    >
      <section className="flex w-60 shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-2xl backdrop-blur-xl">
        <Text as="header" variant="eyebrow" className="px-3.5 pt-3 pb-2 text-muted-foreground">
          Sessions
        </Text>
        <div className="flex flex-1 flex-col overflow-auto px-2.5 pb-2">
          {sessions.length === 0 ? (
            <EmptyRail />
          ) : (
            <ul aria-label="Sessions" className="flex flex-col gap-1.5">
              {sessions.map((session) => (
                <SessionRow key={session.id} session={session} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  )
}

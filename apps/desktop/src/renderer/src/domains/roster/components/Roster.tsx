import { CompassIcon } from '@phosphor-icons/react'
import type { SessionView } from '@/sessionStore'
import { Text } from '@/shared/components/ui'
import { SessionRow } from './SessionRow'

/**
 * Organism: the roster of observed Sessions — one frosted `panel` holding flat inset rows, a
 * pure projection of `sessions`. It is the spine's left column now (SessionScreen owns the
 * window chrome and the split), sized off the screen-local `--c-rail` its splitter drives.
 *
 * An empty roster renders the empty state. Selection is the screen's: the roster only marks
 * which row matches `selectedId` and reports a click through `onSelectSession`.
 */
export function Roster({
  sessions,
  selectedId = null,
  onSelectSession,
}: {
  /** The observed roster, in the order it is listed. Callers read it off the projected
   * state the sessionStore replays from main (`CockpitState.sessions`) — the roster derives
   * nothing from it and re-orders nothing. An empty array is the empty state, not an
   * error. */
  sessions: readonly SessionView[]
  /** The selected Session's id, or `null` for none — the row that matches wears the tint. */
  selectedId?: string | null
  /** Select a Session by id. Optional so the read-only roster stories still typecheck. */
  onSelectSession?: (id: string) => void
}): React.JSX.Element {
  return (
    <section className="flex w-[var(--c-rail)] shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-2xl backdrop-blur-xl">
      <Text as="header" variant="eyebrow" className="px-3.5 pt-3 pb-2 text-muted-foreground">
        Sessions
      </Text>
      <div className="flex flex-1 flex-col overflow-auto px-2.5 pb-2">
        {sessions.length === 0 ? (
          <div className="flex flex-1 select-none flex-col items-center justify-center gap-3 px-4 text-center">
            <CompassIcon weight="light" size={28} className="text-muted-foreground/70" />
            <Text as="p" variant="row" className="text-muted-foreground">
              No Sessions observed yet.
            </Text>
          </div>
        ) : (
          <ul aria-label="Sessions" className="flex flex-col gap-1.5">
            {sessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                selected={session.id === selectedId}
                onSelect={onSelectSession}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

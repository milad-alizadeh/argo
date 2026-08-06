import { useId } from 'react'
import { useDisclosure } from '@/shared/components/ui'
import type { RosterRow, SessionsRoomModel } from '../sessionsRoomModel'
import { ArchivedFooter } from './ArchivedFooter'
import { NewSessionRow } from './NewSessionRow'
import { SessionRow } from './SessionRow'

/**
 * Organism: the roster rail — the active project's observed sessions, `+ New session` just below
 * them and `⚙ Archived (n)` at the foot.
 *
 * With no sessions at all the zero-state is JUST the spawn row: a one-time transient costs no
 * permanent chrome, so there is no hero, no illustration and no onboarding copy. Order, the archive
 * split and every row's word come pre-derived from `buildSessionsRoomModel` — the rail re-orders
 * nothing and grades nothing. Whether the archived list is showing is the rail's own business.
 */
export function Roster({
  model,
  onSelectSession,
  onSpawnSession,
  spawnRefusal = null,
}: {
  /** The rail's whole view-model. An empty one is the zero-state, not an error. */
  model: SessionsRoomModel
  /** Select a session by id. Optional so the read-only stories still typecheck. */
  onSelectSession?: (id: string) => void
  /** Spawn a session in the active project — the visible half of `⌘N`. */
  onSpawnSession?: () => void
  /** Why the last spawn did not happen, verbatim; `null` when none refused. */
  spawnRefusal?: string | null
}): React.JSX.Element {
  const [archivedOpen, toggleArchived] = useDisclosure({})
  const archivedId = useId()

  const rowsOf = (rows: readonly RosterRow[]): React.JSX.Element[] =>
    rows.map((row) => <SessionRow key={row.id} row={row} onSelect={onSelectSession} />)

  return (
    // Flat column, no surface of its own: the rows are planes floating in the room's lit scene, so
    // a panel behind them would be glass on glass. Sized off the screen-local `--c-rail`.
    <div
      data-component="Roster"
      // No top padding of its own: the first card's top edge lines up with the session plane
      // across the split, both sitting on the screen root's one inset.
      className="flex w-[var(--c-rail)] shrink-0 flex-col gap-gap overflow-y-auto p-inset pt-0"
    >
      {model.rows.length > 0 && (
        <ul aria-label="Sessions" className="flex flex-col gap-gap">
          {rowsOf(model.rows)}
        </ul>
      )}
      {/* Below the live rows, not above: the top card then lines up with the header across the
          split, and a spawn affordance is reached for far less often than the sessions are read. */}
      <NewSessionRow onSpawn={onSpawnSession} refusal={spawnRefusal} />
      {model.archivedCount > 0 && (
        // `mt-auto` is what "at the foot" means when the rows do not fill the rail.
        <div className="mt-auto flex flex-col gap-gap">
          <ArchivedFooter
            count={model.archivedCount}
            open={archivedOpen}
            controls={archivedId}
            onToggle={toggleArchived}
          />
          {archivedOpen && (
            <ul id={archivedId} aria-label="Archived sessions" className="flex flex-col gap-gap">
              {rowsOf(model.archived)}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

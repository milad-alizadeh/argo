import type { SessionFacts } from '@shared'
import { useId } from 'react'
import type { SessionView } from '@/sessionStore'
import {
  CaretDownIcon,
  CaretRightIcon,
  IconButton,
  PanelHeader,
  PlusIcon,
  Text,
  useDisclosure,
} from '@/shared/components/ui'
import { deliveryState } from '@/shared/delivery'
import { EmptyRoster } from './EmptyRoster'
import { SessionRow } from './SessionRow'

// The screen spends its ONE pulse budget (R10) on the Delivery strip's head node whenever the
// selected Session is stalled there — `gate`/`fail`/`warn`, the exact condition `LifecycleNode`
// pulses on. Only when that head is quiet does the pulse fall to the roster's top needs-you dot,
// so the two surfaces read the same facts and can never pulse at once.
function selectedLifecycleIsHot(facts: SessionFacts | undefined): boolean {
  if (!facts) return false
  const { lifecycle } = deliveryState(facts)
  if (!lifecycle || lifecycle.terminal) return false
  const head = lifecycle.nodes[lifecycle.head]
  return head === 'gate' || head === 'fail' || head === 'warn'
}

/**
 * Organism: the roster of observed Sessions — one frosted `panel` opening with a **Projects**
 * header and a bordered "+", its rows grouped under a collapsible project row. It is the spine's
 * left column (SessionScreen owns the window chrome and the split), sized off the screen-local
 * `--c-rail` its splitter drives.
 *
 * An empty roster keeps the Projects header and folds the empty state into the panel body rather
 * than swapping the whole panel. Selection is the screen's: the roster only marks which row
 * matches `selectedId` and reports a click through `onSelectSession`.
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
  const [open, toggleOpen] = useDisclosure({ defaultOpen: true })
  const listId = useId()

  // At most one row pulses per render, and only while the selected Session's lifecycle is quiet
  // (otherwise the Delivery strip owns the budget): the top needs-you (amber) row.
  const selected = selectedId == null ? undefined : sessions.find((s) => s.id === selectedId)
  const pulseId = selectedLifecycleIsHot(selected?.facts)
    ? null
    : (sessions.find((s) => deliveryState(s.facts).roster.tone === 'amber')?.id ?? null)

  return (
    <section className="flex w-[var(--c-rail)] shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-2xl backdrop-blur-xl">
      <PanelHeader
        left={
          <Text as="span" variant="eyebrow" className="text-muted-foreground">
            Projects
          </Text>
        }
        right={
          <IconButton label="New session">
            <PlusIcon aria-hidden className="size-4" />
          </IconButton>
        }
      />
      {sessions.length === 0 ? (
        <EmptyRoster />
      ) : (
        // One padded content region: the same `p-inset` the session panel's regions wear, top
        // and bottom equal, with a `gap-gap` rhythm between the project group and its rows.
        <div className="flex min-h-0 flex-1 flex-col gap-gap overflow-hidden p-inset">
          <div className="flex items-center gap-snug">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={listId}
              onClick={toggleOpen}
              className="flex flex-1 items-center gap-snug text-left text-foreground outline-none"
            >
              {open ? (
                <CaretDownIcon aria-hidden className="size-4 shrink-0" />
              ) : (
                <CaretRightIcon aria-hidden className="size-4 shrink-0" />
              )}
              <Text variant="row-strong">argo</Text>
            </button>
            <IconButton label="New session in argo">
              <PlusIcon aria-hidden className="size-4" />
            </IconButton>
          </div>
          {open && (
            <ul
              id={listId}
              aria-label="Sessions"
              className="flex flex-1 flex-col gap-snug overflow-auto"
            >
              {sessions.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  selected={session.id === selectedId}
                  pulse={session.id === pulseId}
                  onSelect={onSelectSession}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

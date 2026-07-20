import { SectionHeader } from '@/shared/components/ui'
import { AgentRow, type AgentRowModel } from './AgentRow'
import { RunRow, type RunRowProps } from './RunRow'

/** One entry in the roster: a lone Agent, or a Run holding its own. */
export type RosterActor =
  | ({ kind: 'agent' } & AgentRowModel)
  | ({ kind: 'run' } & Omit<RunRowProps, 'className'>)

export type BackgroundTasksProps = {
  /** The session's Actors, in the order they were dispatched. An empty roster renders
   * nothing at all — a session with no Agents has no Background Tasks section. */
  actors: readonly RosterActor[]
  /** Extra classes for the section element. */
  className?: string
}

function ActorRow({ actor }: { actor: RosterActor }): React.JSX.Element {
  switch (actor.kind) {
    case 'agent':
      return <AgentRow {...actor} />
    case 'run':
      return <RunRow {...actor} />
  }
}

// An Agent is keyed by the channel it streams to; a Run by its name, which is the only
// identity a Run carries in the roster.
function actorKey(actor: RosterActor): string {
  switch (actor.kind) {
    case 'agent':
      return actor.channelId
    case 'run':
      return actor.label
  }
}

// Organism: the story pane's Actor roster (R15). This section alone owns Agent state —
// each Agent's output lives in its console channel, never here. The header is the name
// alone: no counts, no rollup, because the state lives in the rows.
export function BackgroundTasks({
  actors,
  className,
}: BackgroundTasksProps): React.JSX.Element | null {
  if (actors.length === 0) return null
  return (
    <section aria-label="Background Tasks" className={className}>
      <SectionHeader label="Background Tasks" className="mx-hair mb-gap" />
      {/* Flat inset card inside the panel's one frosted surface — never glass on glass. */}
      <div className="inset-lip rounded-xl border border-inset-hair bg-inset px-snug py-gap">
        {actors.map((actor) => (
          <ActorRow key={actorKey(actor)} actor={actor} />
        ))}
      </div>
    </section>
  )
}

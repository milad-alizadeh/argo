import { StatusDot, Text } from '@/shared/components/ui'
import type { ActivityItem, ToolStepModel } from '../interiorActivity'

function EventLine({ step }: { step: ToolStepModel }): React.JSX.Element {
  return (
    <li className="flex items-baseline gap-gap">
      <Text variant="tag" className="w-nest shrink-0 text-foreground-faint">
        {step.status === 'in_progress' ? 'now' : step.status.replace('_', ' ')}
      </Text>
      <Text variant="code" className="min-w-0 text-foreground-soft">
        {step.target === null ? step.name : `${step.name} · ${step.target}`}
      </Text>
    </li>
  )
}

function SubagentDetail({
  item,
}: {
  item: Extract<ActivityItem, { kind: 'subagent' }>
}): React.JSX.Element {
  const { subagent, events } = item
  return (
    <>
      <div className="flex items-center gap-snug">
        <StatusDot tone={subagent.dot.tone} glow={subagent.dot.glow} pulse={subagent.dot.pulse} />
        <Text as="h3" variant="row-strong" className="min-w-0 flex-1 truncate text-foreground">
          {subagent.name}
        </Text>
        <Text variant="eyebrow" className="text-foreground-soft">
          {subagent.status}
        </Text>
      </div>
      {events.length === 0 ? (
        <Text variant="meta" className="text-foreground-faint">
          no live feed yet — nothing observed from this subagent
        </Text>
      ) : (
        <ul aria-label="Subagent feed" className="flex flex-col gap-tight">
          {events.map((step) => (
            <EventLine key={step.key} step={step} />
          ))}
        </ul>
      )}
    </>
  )
}

/**
 * Organism: the detail pane's content for one item — a subagent's live feed, or a tool step's own
 * record.
 *
 * The pane is always populated: every item in the list has a section here, which is what makes the
 * continuous feed continuous and leaves no empty gutter to look at.
 */
export function AgentFeed({ item }: { item: ActivityItem }): React.JSX.Element {
  return (
    <div data-component="AgentFeed" className="flex flex-col gap-gap">
      {item.kind === 'subagent' ? (
        <SubagentDetail item={item} />
      ) : (
        <>
          <div className="flex items-center gap-snug">
            <StatusDot
              tone={item.step.dot.tone}
              glow={item.step.dot.glow}
              pulse={item.step.dot.pulse}
            />
            <Text as="h3" variant="row-strong" className="min-w-0 flex-1 truncate text-foreground">
              {item.step.name}
            </Text>
            <Text variant="eyebrow" className="text-foreground-soft">
              {item.step.status.replace('_', ' ')}
            </Text>
          </div>
          <Text variant="code" className="text-foreground-soft">
            {item.step.target ?? 'this call named no target'}
          </Text>
        </>
      )}
    </div>
  )
}

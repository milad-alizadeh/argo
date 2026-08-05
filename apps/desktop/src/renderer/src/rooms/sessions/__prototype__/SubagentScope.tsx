import type { ToolCallKind } from '@shared'
import { cn } from '@/lib/utils'
import { CaretLeftIcon, Text } from '@/shared/components/ui'
import { SUBAGENT_STATES } from '../activityStates'
import type { ActivityItem, ToolStepModel } from '../interiorActivity'
import { STICKY_BAR } from './stickyBar'

// PROTOTYPE. The answer to "where do subagents live": nowhere permanent. A delegate's feed is not a
// SECTION of this session's feed — it is another agent's feed, so opening one SWITCHES THE SCOPE of
// the whole surface, the way clicking into a directory switches a file listing. The sticky bar
// becomes the way back, which is also what tells you at every moment whose feed you are reading.

export type DelegateItem = Extract<ActivityItem, { kind: 'subagent' }>

const KIND_TONE: Record<ToolCallKind, string> = {
  edit: 'text-tone-run',
  delegate: 'text-primary',
  read: 'text-foreground-faint',
  search: 'text-foreground-faint',
  fetch: 'text-foreground-faint',
  execute: 'text-foreground-faint',
  plan: 'text-foreground-faint',
  other: 'text-foreground-faint',
}

function EventRow({ step }: { step: ToolStepModel }): React.JSX.Element {
  return (
    <li className="flex items-baseline gap-gap">
      <Text
        variant="tag"
        className={cn(
          'w-kind-col shrink-0 truncate',
          step.status === 'failed' ? 'text-tone-red' : KIND_TONE[step.kind],
        )}
      >
        {step.kind}
      </Text>
      <Text variant="code" className="min-w-0 flex-1 text-foreground-soft">
        {step.target === null ? step.name : `${step.name} · ${step.target}`}
      </Text>
      {step.at !== null && (
        <Text variant="meta" className="shrink-0 tabular-nums text-foreground-faint">
          {step.at}
        </Text>
      )}
    </li>
  )
}

/** The surface in delegate scope: the way back on top, then that agent's own feed and nothing of the
 * session's — two agents' work on one axis is the misreading the scope switch exists to prevent. */
export function SubagentScope({
  item,
  onBack,
}: {
  item: DelegateItem
  onBack: () => void
}): React.JSX.Element {
  const { subagent, group, events } = item
  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-region pt-0">
      <div className={STICKY_BAR}>
        <button
          type="button"
          onClick={onBack}
          className="flex min-w-0 cursor-pointer items-center gap-snug rounded-md text-left outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring/60"
        >
          <Text aria-hidden variant="row" className="shrink-0 text-foreground-faint">
            <CaretLeftIcon className="icon-sm" />
          </Text>
          <Text variant="tag" className="shrink-0 text-foreground-faint">
            session
          </Text>
          <Text variant="row" className="min-w-0 truncate text-foreground">
            {subagent.name}
          </Text>
        </button>
        <div className="flex-1" />
        <Text variant="tag" className="shrink-0 text-foreground-faint">
          {[group, subagent.took, subagent.tokens === null ? null : `${subagent.tokens} tokens`]
            .filter((part) => part !== null)
            .join(' · ')}
        </Text>
        <Text variant="eyebrow" className="shrink-0 text-foreground-faint">
          {SUBAGENT_STATES[subagent.status].word}
        </Text>
      </div>
      <div className="flex max-w-[78ch] flex-col gap-region pt-region">
        {events.length === 0 ? (
          <Text variant="prose" className="text-foreground-faint">
            no live feed yet — nothing observed from this subagent
          </Text>
        ) : (
          <ul aria-label="Subagent feed" className="flex flex-col gap-snug">
            {events.map((step) => (
              <EventRow key={step.key} step={step} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

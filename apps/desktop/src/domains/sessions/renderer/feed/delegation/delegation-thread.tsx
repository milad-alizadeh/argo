// The Subagent card: start and finish are two nodes on one vertical thread, and the child's live
// line runs between them. It words its facts exactly as the header's Subagents list does.
import { Bot, Check, ChevronRight, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { FEED_CARD_RADIUS_CLASS } from '@/domains/sessions/renderer/feed/content/feed-surface'
import {
  type AgentThread,
  delegationFacts,
  isRunning,
  useDelegationClock,
} from '@/domains/sessions/renderer/feed/delegation/delegation-facts'
import './delegation-thread.css'

const NODE_BOX = 'flex size-(--size-icon-control) shrink-0 items-center justify-center'

function EndNode({ phase }: { phase: AgentThread['phase'] }) {
  if (phase === 'running') {
    return (
      <span className={NODE_BOX}>
        <span className="delegation-node-waiting size-(--size-state-dot) rounded-full bg-active" />
      </span>
    )
  }
  const Icon = phase === 'succeeded' ? Check : X
  return (
    <span className={NODE_BOX}>
      <Icon
        className={`size-(--size-icon-control) ${phase === 'succeeded' ? 'text-active' : 'text-danger'}`}
      />
    </span>
  )
}

function ThreadStep({ node, children }: { node: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-snug">
      {node}
      <div className="flex min-w-0 flex-1 items-baseline gap-snug">{children}</div>
    </div>
  )
}

// One Subagent. `onOpen` is the link into the child's own Session; without one, no chevron.
export function ThreadCard({
  agent,
  now,
  onOpen,
}: {
  agent: AgentThread
  now: number
  onOpen?: () => void
}) {
  const { t } = useTranslation('sessions')
  const { title, state, facts, line } = delegationFacts(agent, now, t)
  const running = agent.phase === 'running'
  return (
    <div className={`border bg-card px-snug py-tight ${FEED_CARD_RADIUS_CLASS}`}>
      <div className="relative flex min-w-0 flex-col gap-tight">
        <span aria-hidden="true" className="delegation-thread-line" data-live={running} />
        <ThreadStep node={<Bot className="size-(--size-icon-control) text-muted-foreground" />}>
          <span className="min-w-0 truncate type-body text-foreground">{title}</span>
          {line === null ? null : <span className="sr-only">{state}</span>}
          {onOpen === undefined ? null : (
            <button
              aria-label={t('delegation.open', { name: title })}
              className="-my-hair -mr-hair ml-auto shrink-0 self-center rounded-row p-hair text-muted-foreground hover:text-foreground"
              onClick={onOpen}
              type="button"
            >
              <ChevronRight aria-hidden="true" className="size-(--size-icon-control)" />
            </button>
          )}
        </ThreadStep>
        <ThreadStep node={<EndNode phase={agent.phase} />}>
          <span
            className={`min-w-0 truncate type-meta ${running ? 'feed-work-shimmer' : 'text-muted-foreground'}`}
          >
            {line ?? state}
          </span>
          {facts === '' ? null : (
            <span className="ml-auto shrink-0 type-meta text-muted-foreground tabular-nums">
              {facts}
            </span>
          )}
        </ThreadStep>
      </div>
    </div>
  )
}

export function DelegationThread({
  agents,
  onOpen,
}: {
  agents: readonly AgentThread[]
  onOpen?: (agent: AgentThread) => void
}) {
  const { t } = useTranslation('sessions')
  const now = useDelegationClock(isRunning(agents))
  return (
    <section aria-label={t('marks.subagents')} className="min-w-0 py-1" data-slot="feed-delegation">
      <ol className="flex min-w-0 flex-col gap-tight">
        {agents.map((agent) => (
          <li key={agent.id}>
            <ThreadCard
              agent={agent}
              now={now}
              onOpen={onOpen === undefined ? undefined : () => onOpen(agent)}
            />
          </li>
        ))}
      </ol>
    </section>
  )
}

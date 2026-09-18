import type { TFunction } from 'i18next'
import { ChevronRight, SquareTerminal } from 'lucide-react'
import { type ReactNode, useContext } from 'react'
import { useTranslation } from 'react-i18next'
import {
  type SessionWork,
  spentTokens,
  WORK_STATE_MARKS,
  type WorkState,
  workDuration,
} from '../components/work/session-work'
import type { SessionFeedRow } from '../types'
import { BackgroundWork, backgroundWorkBlock } from './background-work'
import { FEED_CARD_RADIUS_CLASS } from './content/feed-surface'
import { agentThread } from './delegation/agent-thread'
import { PHASE_STATES, useDelegationClock } from './delegation/delegation-facts'
import { ThreadCard } from './delegation/delegation-thread'

type DelegationRow = Extract<SessionFeedRow, { shape: 'delegation' }>
type DelegationGroup = Extract<SessionFeedRow, { shape: 'delegation-group' }>
type Actor = DelegationRow['actor']

function WorkMark({ state }: { state: WorkState | null }) {
  return (
    <span className="relative inline-flex shrink-0 text-muted-foreground">
      <SquareTerminal aria-hidden="true" className="size-(--size-icon-control)" />
      <span
        aria-hidden="true"
        className={`absolute -top-0.5 -right-0.5 size-(--size-state-dot) rounded-full ring-2 ring-card ${state === null ? 'bg-idle' : WORK_STATE_MARKS[state]}`}
      />
    </span>
  )
}

function workStateText(state: WorkState | null, status: string | null, t: TFunction<'sessions'>) {
  if (state === null) return status
  return t(`workState.${state}`)
}

// The colored state mark is visual; its fact remains available to screen readers before the metrics.
function WorkFacts({
  state,
  status,
  target,
}: {
  state: WorkState | null
  status: string | null
  target: SessionWork | null
}) {
  const { t } = useTranslation('sessions')
  const now = useDelegationClock(state === 'running')
  const work = target?.kind === 'shell' ? target.command : (target?.delegation ?? null)
  const elapsed = work === null ? null : workDuration(work.startedAt, work.endedAt, now)
  const tokens = spentTokens(target?.kind === 'delegation' ? target.usage.tokens : null, t)
  const stateText = workStateText(state, status, t)
  return (
    <span className="flex flex-1 shrink-0 items-center justify-end gap-3 whitespace-nowrap tabular-nums">
      {stateText === null ? null : <span className="sr-only">{stateText}</span>}
      {elapsed === null ? null : <span>{elapsed}</span>}
      {tokens === null ? null : <span>{tokens}</span>}
    </span>
  )
}

// The card's bordered box; linked to its work, it is one button into that work's terminal.
function CardFrame({ target, children }: { target: SessionWork | null; children: ReactNode }) {
  const links = useContext(BackgroundWork)
  const box = `block w-full overflow-hidden border bg-card text-left ${FEED_CARD_RADIUS_CLASS}`
  if (links === null || target === null) return <div className={box}>{children}</div>
  return (
    <button
      className={`group ${box} transition-colors hover:bg-muted/40`}
      onClick={() => links.open(target)}
      type="button"
    >
      {children}
    </button>
  )
}

function Card({
  actor,
  state,
  groupId,
  children,
}: {
  actor: Actor
  state: WorkState | null
  groupId: string | null
  children: ReactNode
}) {
  const { t } = useTranslation('sessions')
  return (
    <section
      aria-label={t(`delegation.${actor}.label`)}
      className="min-w-0 py-1"
      data-actor={actor}
      data-group={groupId ?? undefined}
      data-slot="feed-delegation"
      data-state={state ?? undefined}
    >
      {children}
    </section>
  )
}

// A Subagent is a thread: it starts, its live line runs, and it lands (Sessions/Feed/Delegation).
function AgentCard({
  entries,
  groupId,
}: {
  entries: readonly DelegationRow[]
  groupId: string | null
}) {
  const links = useContext(BackgroundWork)
  const { agent, open } = agentThread(entries, links)
  const now = useDelegationClock(agent.phase === 'running')
  return (
    <Card actor="agent" groupId={groupId} state={PHASE_STATES[agent.phase]}>
      <ThreadCard agent={agent} now={now} onOpen={open} />
    </Card>
  )
}

function ShellCard({
  entries,
  groupId,
}: {
  entries: readonly DelegationRow[]
  groupId: string | null
}) {
  const { t } = useTranslation('sessions')
  const links = useContext(BackgroundWork)
  const { target, status, state, title, line, lineIsCommand } = backgroundWorkBlock(
    'shell',
    entries.at(-1),
    links,
  )
  const running = state === 'running'
  const label = t('delegation.shell.label')
  return (
    <Card actor="shell" groupId={groupId} state={state}>
      <CardFrame target={target}>
        <div
          className={`flex min-w-0 items-center gap-2 px-3.5 py-1.5 type-meta text-muted-foreground ${line === null ? '' : 'border-b border-border/60'}`}
        >
          <WorkMark state={state} />
          <span
            className={`min-w-0 truncate type-body ${running ? 'feed-work-shimmer' : 'text-foreground'}`}
          >
            <span className="sr-only">{running ? t('delegation.shell.running') : label}: </span>
            {title ?? label}
          </span>
          <WorkFacts state={state} status={status} target={target} />
          {target === null || links === null ? null : (
            <ChevronRight
              aria-hidden="true"
              className="size-(--size-icon-control) shrink-0 transition-transform group-hover:translate-x-0.5"
            />
          )}
        </div>
        {line === null ? null : (
          <p
            className={`truncate px-3.5 py-2.5 text-muted-foreground ${lineIsCommand ? 'font-mono type-code' : 'type-meta'}`}
          >
            {line}
          </p>
        )}
      </CardFrame>
    </Card>
  )
}

export function FeedDelegation({ row }: { row: DelegationRow | DelegationGroup }) {
  const entries = row.shape === 'delegation-group' ? row.entries : [row]
  const groupId = row.shape === 'delegation-group' ? row.groupId : null
  if (row.actor === 'agent') return <AgentCard entries={entries} groupId={groupId} />
  return <ShellCard entries={entries} groupId={groupId} />
}

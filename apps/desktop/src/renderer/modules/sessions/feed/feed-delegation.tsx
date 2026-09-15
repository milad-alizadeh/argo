import type { TFunction } from 'i18next'
import { Bot, ChevronRight, SquareTerminal } from 'lucide-react'
import { type ReactNode, useContext, useEffect, useState } from 'react'
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

type DelegationRow = Extract<SessionFeedRow, { shape: 'delegation' }>
type DelegationGroup = Extract<SessionFeedRow, { shape: 'delegation-group' }>
type Actor = DelegationRow['actor']

// The Session header's own two icons (SessionWorkButtons), so a block and its header button match.
const ACTOR_ICON = { agent: Bot, shell: SquareTerminal } satisfies Record<Actor, typeof Bot>

const STATE_INK: Record<WorkState, string> = {
  running: 'text-(--feed-work-ink-active)',
  done: 'text-muted-foreground',
  completed: 'text-muted-foreground',
  failed: 'text-(--feed-work-ink-danger)',
  killed: 'text-(--feed-work-ink-warn)',
  stopped: 'text-(--feed-work-ink-warn)',
}

function useNow(ticking: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!ticking) return
    const timer = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [ticking])
  return now
}

function WorkMark({ actor, state }: { actor: Actor; state: WorkState | null }) {
  const Icon = ACTOR_ICON[actor]
  return (
    <span className="relative inline-flex shrink-0 text-muted-foreground">
      <Icon aria-hidden="true" className="size-(--size-icon-control)" />
      <span
        aria-hidden="true"
        className={`absolute -top-0.5 -right-0.5 size-(--size-state-dot) rounded-full ring-2 ring-card ${state === null ? 'bg-idle' : WORK_STATE_MARKS[state]}`}
      />
    </span>
  )
}

// A running block says so in its shimmering headline, so only a settled state is worded.
function settledWord(state: WorkState | null, status: string | null, t: TFunction<'sessions'>) {
  if (state === null) return status
  return state === 'running' ? null : t(`workState.${state}`)
}

// The settled state word, then the tokens a Subagent spent, then how long the work ran.
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
  const now = useNow(state === 'running')
  const work = target?.kind === 'shell' ? target.command : (target?.delegation ?? null)
  const elapsed = work === null ? null : workDuration(work.startedAt, work.endedAt, now)
  const tokens = spentTokens(target?.kind === 'delegation' ? target.tokens : null, t)
  const word = settledWord(state, status, t)
  return (
    <span className="flex flex-1 shrink-0 items-center justify-end gap-3 whitespace-nowrap tabular-nums">
      {word === null ? null : (
        <span className={state === null ? undefined : STATE_INK[state]}>{word}</span>
      )}
      {tokens === null ? null : <span>{tokens}</span>}
      {elapsed === null ? null : <span>{elapsed}</span>}
    </span>
  )
}

// The card's bordered box; linked to its work, it is one button into that work's feed or terminal.
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

function DelegationCard({
  actor,
  entries,
  groupId = null,
}: {
  actor: Actor
  entries: readonly DelegationRow[]
  groupId?: string | null
}) {
  const { t } = useTranslation('sessions')
  const links = useContext(BackgroundWork)
  const { target, status, state, title, line, lineIsCommand } = backgroundWorkBlock(
    actor,
    entries.at(-1),
    links,
  )
  const running = state === 'running'
  const label = t(`delegation.${actor}.label`)
  const headline = running ? t(`delegation.${actor}.running`) : label
  return (
    <section
      aria-label={label}
      className="min-w-0 py-1"
      data-actor={actor}
      data-group={groupId ?? undefined}
      data-slot="feed-delegation"
      data-state={state ?? undefined}
    >
      <CardFrame target={target}>
        <div
          className={`flex min-w-0 items-center gap-2 px-3.5 py-1.5 type-meta text-muted-foreground ${line === null ? '' : 'border-b border-border/60'}`}
        >
          <WorkMark actor={actor} state={state} />
          <span
            className={`min-w-0 truncate type-body ${running ? 'feed-work-shimmer' : 'text-foreground'}`}
          >
            <span className="sr-only">{headline}: </span>
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
    </section>
  )
}

export function FeedDelegation({ row }: { row: DelegationRow | DelegationGroup }) {
  if (row.shape === 'delegation-group') {
    return <DelegationCard actor={row.actor} entries={row.entries} groupId={row.groupId} />
  }
  return <DelegationCard actor={row.actor} entries={[row]} />
}

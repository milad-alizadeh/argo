// One Subagent event as a small static box (CONTEXT.md L3 · Subagent). It never expands or
// changes after it draws, and a fact the harness did not give is absent, not a placeholder.
import type { TFunction } from 'i18next'
import { Bot } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import {
  durationText,
  readableDelegationName,
  spentTokens,
} from '../../components/work/session-work'
import { joined } from '../../components/work/session-work-entries'
import type { SessionFeedRow } from '../../types'
import { FEED_CARD_RADIUS_CLASS } from '../content/feed-surface'

export type SubagentRow = Extract<SessionFeedRow, { shape: 'subagent' }>

const BOX = `block w-full min-w-0 border bg-card px-snug py-tight text-left ${FEED_CARD_RADIUS_CLASS}`
const END_STATE_KEYS = {
  completed: 'workState.completed',
  failed: 'workState.failed',
  interrupted: 'workState.interrupted',
} as const

const CLICKABLE = 'cursor-pointer hover:bg-accent'

// The end state and the facts the harness gave; duration and tokens belong to `responded` alone.
function boxSummary(row: SubagentRow, t: TFunction<'sessions'>): string {
  const responded = row.event === 'responded'
  return joined([
    row.state === undefined ? null : t(END_STATE_KEYS[row.state]),
    row.type ?? null,
    row.model ?? null,
    responded ? durationText(row.durationMs ?? null) : null,
    responded ? spentTokens(row.tokens ?? null, t) : null,
  ])
}

// `onOpen` opens the Subagent Feed; without one the box is plain, with no click target or cue.
export function SubagentBox({ row, onOpen }: { row: SubagentRow; onOpen?: () => void }) {
  const { t } = useTranslation('sessions')
  const summaryId = useId()
  const title = readableDelegationName(row.name ?? row.subagentId)
  const responded = row.event === 'responded'
  const summary = boxSummary(row, t)
  const tone = row.state === 'failed' ? 'text-danger' : 'text-muted-foreground'
  const body = (
    <div className="flex min-w-0 flex-col gap-hair">
      <div className="flex min-w-0 items-center gap-snug">
        <Bot
          aria-hidden="true"
          className="size-(--size-icon-control) shrink-0 text-muted-foreground"
        />
        <span className="min-w-0 truncate type-body text-foreground">{title}</span>
        <span className="ml-auto shrink-0 type-meta text-muted-foreground">
          {t(`delegation.event.${row.event}`)}
        </span>
      </div>
      {summary === '' ? null : (
        <span className={`type-meta ${tone}`} id={summaryId}>
          {summary}
        </span>
      )}
      {responded && row.text !== undefined ? (
        <span className="min-w-0 truncate type-meta text-foreground">{row.text}</span>
      ) : null}
    </div>
  )
  return (
    <section
      aria-label={t('delegation.agent.label')}
      className="min-w-0 py-1"
      data-event={row.event}
      data-slot="feed-delegation"
      data-state={row.state}
      data-subagent={row.subagentId}
    >
      {onOpen === undefined ? (
        <div className={BOX}>{body}</div>
      ) : (
        <button
          aria-describedby={summary === '' ? undefined : summaryId}
          aria-label={t('delegation.open', { name: title })}
          className={`${BOX} ${CLICKABLE}`}
          onClick={onOpen}
          type="button"
        >
          {body}
        </button>
      )}
    </section>
  )
}

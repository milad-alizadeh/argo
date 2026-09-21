import { Bot } from 'lucide-react'
import { useContext } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DELEGATION_PHASE_WORK_STATES,
  type DelegationPhase,
} from '@/domains/sessions/renderer/feed/delegation/delegation-facts'
import type { SessionFeedRow } from '@/domains/sessions/renderer/types'
import { WORK_STATE_MARKS } from '@/domains/sessions/renderer/work/session-work'
import { readableWorkTitle } from '@/domains/sessions/renderer/work/work-presentation'
import { BackgroundWork } from './background-work'

type SubagentRow = Extract<SessionFeedRow, { shape: 'subagent' }>

const RESPONSE_PHASES = {
  completed: 'succeeded',
  failed: 'failed',
  interrupted: 'interrupted',
} as const satisfies Record<NonNullable<SubagentRow['state']>, DelegationPhase>

const EVENT_TRANSLATION_KEYS = {
  messaged: 'delegation.event.messaged',
  responded: 'delegation.event.responded',
  started: 'delegation.event.started',
} as const satisfies Record<SubagentRow['event'], string>

const RESPONSE_TRANSLATION_KEYS = {
  completed: 'delegation.event.responded',
  failed: 'delegation.event.responded',
  interrupted: 'delegation.event.stopped',
} as const satisfies Record<NonNullable<SubagentRow['state']>, string>

// The phase a row draws: `started` and `messaged` leave the Subagent running, and `responded`
// names how it ended.
function phaseOf(row: SubagentRow): DelegationPhase {
  switch (row.event) {
    case 'started':
    case 'messaged':
      return 'running'
    case 'responded':
      return RESPONSE_PHASES[row.state ?? 'failed']
  }
}

function eventTranslationKey(row: SubagentRow) {
  switch (row.event) {
    case 'started':
    case 'messaged':
      return EVENT_TRANSLATION_KEYS[row.event]
    case 'responded':
      return RESPONSE_TRANSLATION_KEYS[row.state ?? 'failed']
  }
}

function stateMark(phase: DelegationPhase) {
  return WORK_STATE_MARKS[DELEGATION_PHASE_WORK_STATES[phase]]
}

// A Subagent lifecycle event stays where it happened; its title opens the child Session.
export function FeedSubagent({ row }: { row: SubagentRow }) {
  const { t } = useTranslation('sessions')
  const links = useContext(BackgroundWork)
  const target = links?.find({ callId: row.subagentId, name: row.name ?? null }) ?? null
  const open = links === null || target === null ? undefined : () => links.open(target)
  const phase = phaseOf(row)
  const title = readableWorkTitle(row.name ?? row.subagentId)
  const state = t(`workState.${DELEGATION_PHASE_WORK_STATES[phase]}`)
  const label = t(eventTranslationKey(row), { name: title })
  return (
    <section
      aria-label={t('delegation.agent.label')}
      className="min-w-0 py-1"
      data-event={row.event}
      data-slot="feed-delegation"
      data-state={row.state}
      data-subagent={row.subagentId}
    >
      <div className="flex min-w-0 items-center gap-snug py-1 type-body text-muted-foreground">
        <span
          aria-hidden="true"
          className="relative flex size-(--size-icon-inline) shrink-0 items-center"
        >
          <Bot className="size-(--size-icon-inline)" />
          <span
            className={`absolute -right-0.5 bottom-0 size-(--size-state-dot) rounded-full ${stateMark(phase)}`}
            data-slot="delegation-status"
          />
        </span>
        <span className="sr-only">{state}</span>
        {open === undefined ? (
          <span className="min-w-0 truncate">{label}</span>
        ) : (
          <button
            aria-label={label}
            className="min-w-0 truncate rounded-row text-left hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={open}
            type="button"
          >
            {label}
            <span className="sr-only">{state}</span>
          </button>
        )}
      </div>
    </section>
  )
}

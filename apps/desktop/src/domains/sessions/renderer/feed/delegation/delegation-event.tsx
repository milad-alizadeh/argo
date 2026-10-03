import { useTranslation } from 'react-i18next'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { workStateMarkRecipe } from '../../session-state-recipes'
import type { SessionFeedRow } from '../../types'
import { readableWorkTitle } from '../../work/presentation'
import { DELEGATION_PHASE_WORK_STATES, type DelegationPhase } from './delegation-facts'

type SubagentRow = Extract<SessionFeedRow, { shape: 'subagent' }>

const RESPONSE_PHASES = {
  completed: 'succeeded',
  failed: 'failed',
  interrupted: 'interrupted',
} as const satisfies Record<NonNullable<SubagentRow['state']>, DelegationPhase>

const RESPONSE_SENTENCES = {
  completed: 'responded',
  failed: 'responded',
  interrupted: 'stopped',
} as const satisfies Record<NonNullable<SubagentRow['state']>, string>

function phaseOf(row: SubagentRow): DelegationPhase {
  switch (row.event) {
    case 'started':
    case 'messaged':
      return 'running'
    case 'responded':
      return RESPONSE_PHASES[row.state ?? 'failed']
  }
}

function sentenceOf(row: SubagentRow) {
  switch (row.event) {
    case 'started':
    case 'messaged':
      return row.event
    case 'responded':
      return RESPONSE_SENTENCES[row.state ?? 'failed']
  }
}

// A nickname is who did the work, so it leads the sentence and the task follows it.
function eventTranslationKey(row: SubagentRow) {
  const group = row.nickname === undefined ? 'event' : 'namedEvent'
  return `delegation.${group}.${sentenceOf(row)}` as const
}

// A DelegationEvent owns the shared feed treatment for a Subagent lifecycle event.
export function DelegationEvent({ row, onOpen }: { row: SubagentRow; onOpen?: () => void }) {
  const { t } = useTranslation('sessions')
  const phase = phaseOf(row)
  const title = readableWorkTitle(row.name ?? row.subagentId)
  const state = t(`workState.${DELEGATION_PHASE_WORK_STATES[phase]}`)
  const label = t(eventTranslationKey(row), { name: title, nickname: row.nickname })
  const stateMark = workStateMarkRecipe[DELEGATION_PHASE_WORK_STATES[phase]]
  return (
    <article
      // An article, not a landmark: the parent Feed and the Subagent Feed can both draw the same event.
      aria-label={label}
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
          <Icon name="agent" className="size-(--size-icon-inline)" />
          <span
            className={`absolute -right-0.5 bottom-0 size-(--size-state-dot) rounded-full ${stateMark}`}
            data-slot="delegation-status"
          />
        </span>
        <span className="sr-only">{state}</span>
        {onOpen === undefined ? (
          <span className="min-w-0 truncate">{label}</span>
        ) : (
          <button
            aria-label={label}
            className="min-w-0 truncate rounded-row text-left hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={onOpen}
            type="button"
          >
            {label}
            <span className="sr-only">{state}</span>
          </button>
        )}
      </div>
    </article>
  )
}

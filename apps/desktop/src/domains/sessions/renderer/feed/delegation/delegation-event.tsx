import { useId, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/platform/renderer/components/icon/icon'
import type { SessionFeedRow } from '../../types'
import { WORK_STATE_MARKS } from '../../work/session-work'
import { readableWorkTitle } from '../../work/work-presentation'
import { FeedMarkdown } from '../content/feed-markdown'
import { DELEGATION_PHASE_WORK_STATES, type DelegationPhase } from './delegation-facts'

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

// What the row says: the parent's prompt on a start or message, the Subagent's reply on a response.
function bodyOf(row: SubagentRow): string | undefined {
  switch (row.event) {
    case 'started':
    case 'messaged':
      return row.prompt
    case 'responded':
      return row.text
  }
}

const BODY_TOGGLE_KEYS = {
  messaged: 'delegation.body.showPrompt',
  responded: 'delegation.body.showReply',
  started: 'delegation.body.showPrompt',
} as const satisfies Record<SubagentRow['event'], string>

// Three lines of the body, and a disclosure for the rest once it overflows them.
function DelegationBody({ event, text }: { event: SubagentRow['event']; text: string }) {
  const { t } = useTranslation('sessions')
  const bodyId = useId()
  const body = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)
  useLayoutEffect(() => {
    const element = body.current
    if (element === null || expanded) return
    const measure = () => setOverflows(element.scrollHeight > element.clientHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [expanded])
  return (
    <div className="min-w-0 pl-[calc(var(--size-icon-inline)+var(--spacing-snug))]">
      <div
        className={`min-w-0 break-words type-body text-muted-foreground ${expanded ? '' : 'line-clamp-3'}`}
        data-slot="delegation-body"
        id={bodyId}
        ref={body}
      >
        <FeedMarkdown text={text} />
      </div>
      {overflows || expanded ? (
        <button
          aria-controls={bodyId}
          aria-expanded={expanded}
          className="rounded-row type-body text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setExpanded(!expanded)}
          type="button"
        >
          {expanded ? t('delegation.body.showLess') : t(BODY_TOGGLE_KEYS[event])}
        </button>
      ) : null}
    </div>
  )
}

// A DelegationEvent owns the shared feed treatment for a Subagent lifecycle event.
export function DelegationEvent({ row, onOpen }: { row: SubagentRow; onOpen?: () => void }) {
  const { t } = useTranslation('sessions')
  const phase = phaseOf(row)
  const title = readableWorkTitle(row.name ?? row.subagentId)
  const state = t(`workState.${DELEGATION_PHASE_WORK_STATES[phase]}`)
  const label = t(eventTranslationKey(row), { name: title })
  const stateMark = WORK_STATE_MARKS[DELEGATION_PHASE_WORK_STATES[phase]]
  const text = bodyOf(row)
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
      {text === undefined || text === '' ? null : <DelegationBody event={row.event} text={text} />}
    </article>
  )
}

// One Subagent event as a line in the Feed's own tool-row style (CONTEXT.md L3 · Subagent). It
// opens to the facts the harness gave, and a fact it did not give is absent, not a placeholder.
import type { TFunction } from 'i18next'
import { Bot } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CollapsibleText } from '../../../../../platform/renderer/components/collapsible-text'
import {
  durationText,
  readableDelegationName,
  spentTokens,
} from '../../components/work/session-work'
import { joined } from '../../components/work/session-work-entries'
import type { SessionFeedRow } from '../../types'

export type SubagentRow = Extract<SessionFeedRow, { shape: 'subagent' }>

const END_STATE_KEYS = {
  completed: 'workState.completed',
  failed: 'workState.failed',
  interrupted: 'workState.interrupted',
} as const

// The end state and the facts the harness gave; duration and tokens belong to `responded` alone.
function lineSummary(row: SubagentRow, t: TFunction<'sessions'>): string {
  const responded = row.event === 'responded'
  return joined([
    row.state === undefined ? null : t(END_STATE_KEYS[row.state]),
    row.type ?? null,
    row.model ?? null,
    responded ? durationText(row.durationMs ?? null) : null,
    responded ? spentTokens(row.tokens ?? null, t) : null,
  ])
}

// `onOpen` opens the Subagent Feed; without one the line shows no way in.
export function SubagentBox({ row, onOpen }: { row: SubagentRow; onOpen?: () => void }) {
  const { t } = useTranslation('sessions')
  const name = readableDelegationName(row.name ?? row.subagentId)
  const summary = lineSummary(row, t)
  const reply = row.event === 'responded' ? row.text : undefined
  const title = t(`delegation.line.${row.event}`, { name })
  const hasContent = summary !== '' || reply !== undefined || onOpen !== undefined
  return (
    <section
      aria-label={t('delegation.agent.label')}
      className="min-w-0"
      data-event={row.event}
      data-slot="feed-delegation"
      data-state={row.state}
      data-subagent={row.subagentId}
    >
      {hasContent ? (
        <CollapsibleText
          content={
            <>
              {summary === '' ? null : (
                <p className={row.state === 'failed' ? 'text-danger' : 'text-muted-foreground'}>
                  {summary}
                </p>
              )}
              {reply === undefined ? null : <p className="text-foreground">{reply}</p>}
              {onOpen === undefined ? null : (
                <button
                  className="cursor-pointer text-muted-foreground underline hover:text-foreground"
                  onClick={onOpen}
                  type="button"
                >
                  {t('delegation.open', { name })}
                </button>
              )}
            </>
          }
          contentVariant="plain"
          icon={Bot}
          title={title}
        />
      ) : (
        <div className="flex w-full items-center gap-2 py-1 type-body text-muted-foreground">
          <Bot aria-hidden="true" className="!size-(--size-icon-inline) shrink-0" />
          <span className="min-w-0 truncate">{title}</span>
        </div>
      )}
    </section>
  )
}

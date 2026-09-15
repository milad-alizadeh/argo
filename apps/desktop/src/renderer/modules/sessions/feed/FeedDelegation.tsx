import { Bot, Terminal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { SessionFeedRow } from '../types'
import { FEED_CARD_RADIUS_CLASS } from './content/feedSurface'

type DelegationRow = Extract<SessionFeedRow, { shape: 'delegation' }>
type DelegationGroup = Extract<SessionFeedRow, { shape: 'delegation-group' }>

const DELEGATION_PRESENTATION = {
  agent: Bot,
  shell: Terminal,
} satisfies Record<DelegationRow['actor'], typeof Bot>

function DelegationDetail({ row }: { row: DelegationRow }) {
  return (
    <div className="min-w-0 space-y-1">
      {row.action === null ? null : (
        <p className="whitespace-pre-wrap break-words text-foreground type-body">{row.action}</p>
      )}
      {row.progress === null ? null : (
        <p className="break-words text-muted-foreground type-meta">{row.progress}</p>
      )}
    </div>
  )
}

function DelegationCard({
  actor,
  entries,
  groupId = null,
}: {
  actor: DelegationRow['actor']
  entries: readonly DelegationRow[]
  groupId?: string | null
}) {
  const { t } = useTranslation('sessions')
  const Icon = DELEGATION_PRESENTATION[actor]
  const latest = entries.at(-1)
  const label = t(`delegation.${actor}.label`)
  const status = latest?.status ?? null
  return (
    <section
      aria-label={label}
      className={`min-w-0 border border-border/70 bg-muted/50 px-3 py-2.5 ${FEED_CARD_RADIUS_CLASS}`}
      data-actor={actor}
      data-group={groupId ?? undefined}
      data-slot="feed-delegation"
    >
      <div className="mb-1.5 flex min-w-0 items-center gap-2 type-meta">
        <Icon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 font-medium text-foreground">{label}</span>
        {status === null ? null : (
          <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-muted-foreground">
            {status}
          </span>
        )}
      </div>
      <div className="space-y-2">
        {entries.map((entry) => (
          <DelegationDetail key={entry.id} row={entry} />
        ))}
      </div>
    </section>
  )
}

export function FeedDelegation({ row }: { row: DelegationRow | DelegationGroup }) {
  if (row.shape === 'delegation-group') {
    return <DelegationCard actor={row.actor} entries={row.entries} groupId={row.groupId} />
  }
  return <DelegationCard actor={row.actor} entries={[row]} />
}

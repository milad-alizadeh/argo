import { useContext } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  AgentThread,
  DelegationPhase,
} from '@/domains/sessions/renderer/feed/delegation/delegation-facts'
import { ThreadCard } from '@/domains/sessions/renderer/feed/delegation/delegation-thread'
import type { SessionFeedRow } from '@/domains/sessions/renderer/types'
import { BackgroundWork } from './background-work'

type SubagentRow = Extract<SessionFeedRow, { shape: 'subagent' }>

// The phase a row draws: `started` and `messaged` leave the Subagent running, and `responded`
// names how it ended.
function phaseOf(row: SubagentRow): DelegationPhase {
  if (row.event !== 'responded') return 'running'
  return row.state === 'completed' ? 'succeeded' : 'failed'
}

function threadOf(row: SubagentRow): AgentThread {
  return {
    id: row.id,
    name: row.name ?? row.subagentId,
    phase: phaseOf(row),
    // The messaged row never draws the text the Session sent; only `responded` keeps a reply line.
    line: row.event === 'responded' ? (row.text ?? null) : null,
    durationMs: row.durationMs ?? null,
    tokens: row.tokens ?? null,
    model: row.model ?? null,
  }
}

// One lifecycle event of a Subagent, drawn where it happened. It never changes after it draws:
// the linked work only supplies the way into the child's own Session.
export function FeedSubagent({ row }: { row: SubagentRow }) {
  const { t } = useTranslation('sessions')
  const links = useContext(BackgroundWork)
  const target = links?.find({ callId: row.subagentId, name: row.name ?? null }) ?? null
  const open = links === null || target === null ? undefined : () => links.open(target)
  return (
    <section
      aria-label={t('delegation.agent.label')}
      className="min-w-0 py-1"
      data-event={row.event}
      data-slot="feed-delegation"
      data-state={row.state}
      data-subagent={row.subagentId}
    >
      <ThreadCard agent={threadOf(row)} onOpen={open} />
    </section>
  )
}

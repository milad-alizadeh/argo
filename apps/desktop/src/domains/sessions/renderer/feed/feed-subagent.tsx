import { useContext } from 'react'
import type { SessionFeedRow } from '@/domains/sessions/renderer/types'
import { BackgroundWork } from './background-work'
import { DelegationEvent } from './delegation/delegation-event'

type SubagentRow = Extract<SessionFeedRow, { shape: 'subagent' }>

// FeedSubagent resolves its row to a child Session and leaves event presentation to DelegationEvent.
export function FeedSubagent({ row }: { row: SubagentRow }) {
  const links = useContext(BackgroundWork)
  const target = links?.find({ callId: row.subagentId, name: row.name ?? null }) ?? null
  const open = links === null || target === null ? undefined : () => links.open(target)
  return <DelegationEvent onOpen={open} row={row} />
}

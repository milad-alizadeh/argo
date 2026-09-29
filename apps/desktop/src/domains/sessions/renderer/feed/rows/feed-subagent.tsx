import { useContext } from 'react'
import { feedSubagents } from '@/domains/sessions/api/feed/feed-subagents'
import type { SessionFeedRow } from '../../types'
import { DelegationEvent } from '../delegation/delegation-event'
import { BackgroundWork } from './background-work'

type SubagentRow = Extract<SessionFeedRow, { shape: 'subagent' }>

// FeedSubagent opens its row's Subagent and leaves event presentation to DelegationEvent.
export function FeedSubagent({ row }: { row: SubagentRow }) {
  const links = useContext(BackgroundWork)
  const [subagent] = feedSubagents([row])
  const open = links === null || subagent === undefined ? undefined : () => links.open(subagent)
  return <DelegationEvent onOpen={open} row={row} />
}

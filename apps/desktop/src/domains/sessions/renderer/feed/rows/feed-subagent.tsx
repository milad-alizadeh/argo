import { useContext } from 'react'
import type { SessionFeedRow } from '../../types'
import { DelegationEvent } from '../delegation/delegation-event'
import { BackgroundWork } from './background-work'

type SubagentRow = Extract<SessionFeedRow, { shape: 'subagent' }>

// FeedSubagent opens its row by id and leaves event presentation to DelegationEvent.
export function FeedSubagent({ row }: { row: SubagentRow }) {
  const links = useContext(BackgroundWork)
  const open = links === null ? undefined : () => links.open(row.subagentId)
  return <DelegationEvent onOpen={open} row={row} />
}

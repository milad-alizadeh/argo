import { useContext } from 'react'
import { BackgroundWork } from './background-work'
import { SubagentBox, type SubagentRow } from './delegation/subagent-box'

// The linked work only supplies the way into the Subagent Feed; the box never changes.
export function FeedSubagent({ row }: { row: SubagentRow }) {
  const links = useContext(BackgroundWork)
  const target = links?.find({ callId: row.subagentId, name: row.name ?? null }) ?? null
  const open = links === null || target === null ? undefined : () => links.open(target)
  return <SubagentBox onOpen={open} row={row} />
}

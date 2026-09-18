import { Sparkles } from 'lucide-react'
import type { LiveActivity } from '../../contract/feed-rows'
import type { SessionFeedRow } from '../types'
import { toolPresentation } from './feed-tools'

type ToolGroup = Extract<SessionFeedRow, { shape: 'tool-group' }>
type ToolKind = ToolGroup['calls'][number]['kind']

// While the group is the running Turn's tail it carries the Session's activity as its headline,
// the same fact the roster draws. A group with a call still running names that call.
export function liveActivity(group: ToolGroup): LiveActivity | null {
  if (group.headline !== undefined) return group.headline
  const call = group.calls.findLast((call) => call.status === 'running')
  return call === undefined ? null : { kind: call.kind, label: call.label, open: true }
}

// A thought titles under a spark; a call under its own kind; a settled count under the terminal.
export function groupIcon(activity: LiveActivity | null, titleKind: ToolKind | undefined) {
  if (activity?.kind === 'thought') return Sparkles
  return toolPresentation(titleKind ?? activity?.kind ?? 'command').icon
}

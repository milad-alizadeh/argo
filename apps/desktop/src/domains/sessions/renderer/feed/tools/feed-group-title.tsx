import type { LiveActivity } from '@/domains/sessions/api/feed/feed-rows'
import type { IconName } from '@/platform/renderer/components/icon/icon'
import type { SessionFeedRow } from '../../types'
import { toolPresentation } from './feed-tools'

type ToolGroup = Extract<SessionFeedRow, { shape: 'tool-group' }>
type ToolKind = ToolGroup['calls'][number]['kind']

// While the group is the running Turn's tail it carries the Session's activity as its headline,
// the same fact the roster draws. Any other group is settled, whatever its calls last reported.
export function liveActivity(group: ToolGroup): LiveActivity | null {
  return group.headline ?? null
}

// A thought titles under a spark; a call under its own kind; a settled count under the terminal.
export function groupIcon(
  activity: LiveActivity | null,
  titleKind: ToolKind | undefined,
): IconName {
  if (activity?.kind === 'thought') return 'sparkles'
  return toolPresentation(titleKind ?? activity?.kind ?? 'command').icon
}

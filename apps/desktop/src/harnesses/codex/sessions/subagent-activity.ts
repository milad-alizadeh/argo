import type { TranscriptRecord } from '@/domains/sessions/contract/model'
import { isIdentifier } from '@/shared/validation'

// What a `SubAgentActivity` kind reports as a Subagent event.
const ACTIVITY_EVENTS = {
  started: { event: 'started' },
  interacted: { event: 'messaged' },
  completed: { event: 'responded', state: 'completed' },
  interrupted: { event: 'responded', state: 'interrupted' },
} as const

export function agentLabel(agentPath: string): string | null {
  const name = agentPath.split('/').findLast(Boolean)
  const [first, ...rest] = name?.split(/[_-]+/).filter(Boolean) ?? []
  return first === undefined
    ? null
    : `${first[0]?.toUpperCase()}${first.slice(1)}${rest.length === 0 ? '' : ` ${rest.join(' ')}`}`
}

export function subagentActivity(
  record: Record<string, unknown>,
  item: Record<string, unknown>,
): TranscriptRecord | null {
  if (item.type !== 'SubAgentActivity' || typeof item.id !== 'string' || !isIdentifier(item.id))
    return null
  if (typeof item.agent_thread_id !== 'string' || !isIdentifier(item.agent_thread_id)) return null
  if (typeof item.agent_path !== 'string') return null
  if (typeof item.kind !== 'string' || !Object.hasOwn(ACTIVITY_EVENTS, item.kind)) return null
  const activity = ACTIVITY_EVENTS[item.kind as keyof typeof ACTIVITY_EVENTS]
  const name = agentLabel(item.agent_path)
  const base = {
    kind: 'subagent' as const,
    uuid: item.id,
    timestamp: typeof record.timestamp === 'string' ? record.timestamp : null,
    subagentId: item.agent_thread_id,
    ...(name === null ? {} : { name }),
  }
  return 'state' in activity
    ? { ...base, event: activity.event, state: activity.state }
    : { ...base, event: activity.event }
}

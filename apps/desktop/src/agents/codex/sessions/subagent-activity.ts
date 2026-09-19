import { isIdentifier } from '@/shared/validation'
import type { TranscriptRecord } from '../../../domains/sessions/contract/transcript'

// What a `SubAgentActivity` kind reports as a Subagent event; `completed` is the only one that ends it.
const ACTIVITY_EVENTS = {
  started: 'started',
  interacted: 'messaged',
  completed: 'responded',
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
  const event = ACTIVITY_EVENTS[item.kind as keyof typeof ACTIVITY_EVENTS]
  const name = agentLabel(item.agent_path)
  const base = {
    kind: 'subagent' as const,
    uuid: item.id,
    timestamp: typeof record.timestamp === 'string' ? record.timestamp : null,
    subagentId: item.agent_thread_id,
    ...(name === null ? {} : { name }),
  }
  return event === 'responded' ? { ...base, event, state: 'completed' } : { ...base, event }
}

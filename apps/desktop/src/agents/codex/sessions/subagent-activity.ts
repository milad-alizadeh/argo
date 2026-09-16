import { isIdentifier } from '@/boundary'
import type { TranscriptRecord } from '@/core/sessions/transcript'

const SUBAGENT_ACTIVITY_STATUS = { started: 'running', completed: 'completed' } as const

function agentLabel(agentPath: string): string | null {
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
  const status = SUBAGENT_ACTIVITY_STATUS[item.kind as keyof typeof SUBAGENT_ACTIVITY_STATUS]
  if (status === undefined) return null
  return {
    kind: 'delegation',
    uuid: item.id,
    timestamp: typeof record.timestamp === 'string' ? record.timestamp : null,
    actor: 'agent',
    action: agentLabel(item.agent_path),
    status,
    progress: null,
    groupId: item.agent_thread_id,
    callId: null,
  }
}

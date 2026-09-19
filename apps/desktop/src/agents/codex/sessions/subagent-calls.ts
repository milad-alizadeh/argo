// Joins Codex's collaboration calls to the `SubAgentActivity` events they cause. A spawn's model is
// on the call and nowhere else, and `interrupt_agent` names its target by path or by name while its
// activity records only the thread, so the fold reads both across the whole rollout.
import type { ToolCall, TranscriptRecord } from '../../../domains/sessions/contract/transcript'
import { agentLabel } from './subagent-activity'

type SubagentCall = NonNullable<Extract<TranscriptRecord, { kind: 'trace' }>['subagentCall']>

// The two collaboration calls whose arguments the Subagent events need: the model a spawn chose,
// and the target a stop names. The rest report through `SubAgentActivity` alone.
export function readSubagentCall(
  record: Record<string, unknown>,
  calls: readonly ToolCall[],
): { subagentCall?: NonNullable<Extract<TranscriptRecord, { kind: 'trace' }>['subagentCall']> } {
  const call = calls.find((candidate) => SUBAGENT_CALLS[candidate.name] !== undefined)
  const intent = call === undefined ? undefined : SUBAGENT_CALLS[call.name]
  if (call === undefined || intent === undefined) return {}
  const text = (key: string) => (typeof call.input[key] === 'string' ? call.input[key] : null)
  return {
    subagentCall: {
      intent,
      callId: call.id,
      timestamp: typeof record.timestamp === 'string' ? record.timestamp : null,
      target: text('target') ?? text('task_name'),
      model: text('model'),
    },
  }
}

const SUBAGENT_CALLS: Record<string, 'start' | 'stop' | undefined> = {
  spawn_agent: 'start',
  interrupt_agent: 'stop',
}

export function readingSubagentCalls(records: TranscriptRecord[]): TranscriptRecord[] {
  const models = new Map<string, string>()
  for (const record of records) {
    const call = record.kind === 'trace' ? record.subagentCall : undefined
    if (call?.intent === 'start' && call.model !== null) models.set(call.callId, call.model)
  }
  const threads = new Map<string, string>()
  return records.flatMap((record): TranscriptRecord[] => {
    if (record.kind === 'subagent') {
      if (record.name !== undefined) threads.set(record.name, record.subagentId)
      const model = record.event === 'started' ? models.get(record.uuid) : undefined
      return [model === undefined ? record : { ...record, model }]
    }
    const call = record.kind === 'trace' ? record.subagentCall : undefined
    return call?.intent === 'stop' ? [record, ...interrupted(call, threads)] : [record]
  })
}

function interrupted(call: SubagentCall, threads: Map<string, string>): TranscriptRecord[] {
  const label = call.target === null ? null : agentLabel(call.target)
  const subagentId = label === null ? undefined : threads.get(label)
  if (subagentId === undefined) return []
  return [
    {
      kind: 'subagent',
      uuid: `${call.callId}:interrupted`,
      timestamp: call.timestamp,
      subagentId,
      event: 'responded',
      state: 'interrupted',
      ...(label === null ? {} : { name: label }),
    },
  ]
}

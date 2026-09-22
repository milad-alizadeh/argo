// Joins Codex's collaboration calls to the `SubAgentActivity` events they cause. A spawn's model is
// on the call and nowhere else, and `interrupt_agent` names its target by path or by name while its
// activity records only the thread, so the fold reads both across the whole rollout.
import { elapsedMilliseconds } from '@/domains/sessions/contract/duration'
import type { TranscriptRecord } from '@/domains/sessions/contract/model/transcript/transcript'
import { agentLabel } from './subagent-activity'

type SubagentCall = NonNullable<Extract<TranscriptRecord, { kind: 'trace' }>['subagentCall']>
type SubagentRecord = Extract<TranscriptRecord, { kind: 'subagent' }>
type RawToolCall = { id: string; name: string; input: Record<string, unknown> }

// The two collaboration calls whose arguments the Subagent events need: the model a spawn chose,
// and the target a stop names. The rest report through `SubAgentActivity` alone.
export function readSubagentCall(
  record: Record<string, unknown>,
  calls: readonly RawToolCall[],
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
  const nativeInterruptions = new Set(
    records.flatMap((record) =>
      record.kind === 'subagent' && record.event === 'responded' && record.state === 'interrupted'
        ? [record.subagentId]
        : [],
    ),
  )
  const threads = new Map<string, string>()
  const startedAt = new Map<string, string | null>()
  return records.flatMap((record): TranscriptRecord[] => {
    if (record.kind === 'subagent') {
      if (record.name !== undefined) threads.set(record.name, record.subagentId)
      if (record.event === 'started') startedAt.set(record.subagentId, record.timestamp)
      return [subagentWithFacts(record, models, startedAt)]
    }
    const call = record.kind === 'trace' ? record.subagentCall : undefined
    return call?.intent === 'stop'
      ? [record, ...interrupted(call, threads, nativeInterruptions)]
      : [record]
  })
}

function subagentWithFacts(
  record: SubagentRecord,
  models: ReadonlyMap<string, string>,
  startedAt: ReadonlyMap<string, string | null>,
): SubagentRecord {
  const model = record.event === 'started' ? models.get(record.uuid) : undefined
  const durationMs =
    record.event === 'responded'
      ? elapsedMilliseconds(startedAt.get(record.subagentId), record.timestamp)
      : null
  return {
    ...record,
    ...(model === undefined ? {} : { model }),
    ...(durationMs === null ? {} : { durationMs }),
  }
}

function interrupted(
  call: SubagentCall,
  threads: Map<string, string>,
  nativeInterruptions: ReadonlySet<string>,
): TranscriptRecord[] {
  const label = call.target === null ? null : agentLabel(call.target)
  const subagentId = label === null ? undefined : threads.get(label)
  if (subagentId === undefined || nativeInterruptions.has(subagentId)) return []
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

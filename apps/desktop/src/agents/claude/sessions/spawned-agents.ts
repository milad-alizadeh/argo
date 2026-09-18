// A Subagent the Session spawned, read the way Codex's `SubAgentActivity` is read: the spawning
// call becomes the delegation's own record and draws no tool row, and its answer lands it. The
// Feed and the Roster then draw one Thread card for either CLI (CONTEXT.md L3 · Subagent).
import type { ToolCall, TranscriptMessage, TranscriptRecord } from '@/core/sessions/transcript'

// The CLI renamed `Task` to `Agent`; a transcript written before the rename still names the old one.
const SPAWNING_TOOLS = new Set(['Task', 'Agent'])

type Delegation = Extract<TranscriptRecord, { kind: 'delegation' }>

function isSpawn(call: ToolCall): boolean {
  return SPAWNING_TOOLS.has(call.name)
}

function description(call: ToolCall): string | null {
  return typeof call.input.description === 'string' && call.input.description.trim().length > 0
    ? call.input.description
    : null
}

function spawned(call: ToolCall, message: TranscriptMessage): Delegation {
  return {
    kind: 'delegation',
    uuid: `${call.id}:spawned`,
    timestamp: message.timestamp,
    actor: 'agent',
    action: description(call),
    status: 'running',
    progress: null,
    groupId: call.id,
    callId: call.id,
  }
}

function landed(call: ToolCall, message: TranscriptMessage): Delegation {
  return { ...spawned(call, message), uuid: `${call.id}:landed`, status: 'completed' }
}

function withoutSpawns(message: TranscriptMessage, spawns: ToolCall[]): TranscriptMessage {
  const ids = new Set(spawns.map((call) => call.id))
  return {
    ...message,
    blocks: message.blocks.filter((block) => block.shape !== 'tool' || !ids.has(block.callId)),
    toolCalls: message.toolCalls.filter((call) => !ids.has(call.id)),
  }
}

// An answer that is only a receipt (`Async agent launched`) lands nothing: the task notification
// the CLI writes later does, through `readTaskDelivery`.
function landings(message: TranscriptMessage, open: Map<string, ToolCall>): Delegation[] {
  return message.answeredCalls.flatMap((callId) => {
    const call = open.get(callId)
    if (call === undefined) return []
    open.delete(callId)
    const receipt = message.toolResults?.some(
      (result) => result.callId === callId && result.background !== undefined,
    )
    return receipt === true ? [] : [landed(call, message)]
  })
}

export function readingSpawnedAgents(records: TranscriptRecord[]): TranscriptRecord[] {
  const open = new Map<string, ToolCall>()
  return records.flatMap((record): TranscriptRecord[] => {
    if (record.kind !== 'message') return [record]
    const spawns = record.toolCalls.filter(isSpawn)
    for (const call of spawns) open.set(call.id, call)
    const message = spawns.length === 0 ? record : withoutSpawns(record, spawns)
    return [message, ...spawns.map((call) => spawned(call, record)), ...landings(record, open)]
  })
}

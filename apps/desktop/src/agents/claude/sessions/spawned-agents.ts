// A Subagent the Session spawned, reported as lifecycle events the way Codex's `SubAgentActivity`
// is: the spawning call becomes a `started` event and draws no tool row, `SendMessage` becomes a
// `messaged` one, and a foreground result becomes `responded` in the place it arrived. A
// background Subagent answers with a receipt, so its task notification does that later
// (`task-notification.ts`), joined by the tool-use id (CONTEXT.md L3 · Subagent).
import {
  resultText,
  type SubagentEvent,
  type ToolCall,
  type TranscriptMessage,
  type TranscriptRecord,
} from '@/domains/sessions/contract/model/transcript'
import { responded, started } from './subagent-events'
import { Agents, messaged, stopped } from './subagent-targets'

type Control = Extract<ToolCall, { kind: 'subagent-control' }>

export function withoutCalls(message: TranscriptMessage, calls: ToolCall[]): TranscriptMessage {
  const ids = new Set(calls.map((call) => call.id))
  return {
    ...message,
    blocks: message.blocks.filter((block) => block.shape !== 'tool' || !ids.has(block.callId)),
    toolCalls: message.toolCalls.filter((call) => !ids.has(call.id)),
  }
}

// An answer that is only a receipt (`Async agent launched`) ends nothing: the task notification
// the CLI writes later does.
function responses(message: TranscriptMessage, agents: Agents): SubagentEvent[] {
  return message.answeredCalls.flatMap((callId) => {
    const call = agents.get(callId)
    if (call === undefined) return []
    const result = message.toolResults?.find((candidate) => candidate.callId === callId)
    if (result?.background !== undefined) {
      agents.receipt(callId, result.background.taskId)
      return []
    }
    agents.close(callId)
    return [
      responded({
        call,
        timestamp: message.timestamp,
        startedAt: agents.startedAt(callId),
        ending: {
          state: result?.failed === true ? 'failed' : 'completed',
          reply: result === undefined ? null : resultText(result.blocks),
        },
      }),
    ]
  })
}

export function readingSpawnedAgents(records: TranscriptRecord[]): TranscriptRecord[] {
  const agents = new Agents()
  return records.flatMap((record): TranscriptRecord[] => {
    if (record.kind !== 'message') return [record]
    const spawns = record.toolCalls.filter(
      (call): call is Control => call.kind === 'subagent-control' && call.intent === 'start',
    )
    for (const call of spawns) agents.spawn(call, record.timestamp)
    const messages = record.toolCalls.filter(
      (call): call is Control => call.kind === 'subagent-control' && call.intent === 'message',
    )
    const ended = responses(record, agents)
    // A stop call that names no Subagent is a Shell's, which `background-stop.ts` reads.
    const stops = record.toolCalls
      .filter((call): call is Control => call.kind === 'subagent-control' && call.intent === 'stop')
      .flatMap((call) => {
        const events = stopped(call, record.timestamp, agents)
        return events.length === 0 ? [] : [{ call, events }]
      })
    const hidden = [...spawns, ...messages, ...stops.map((stop) => stop.call)]
    return [
      hidden.length === 0 ? record : withoutCalls(record, hidden),
      ...spawns.map((call) => started(call, record.timestamp)),
      ...messages.flatMap((call) => messaged(call, record.timestamp, agents)),
      ...ended,
      ...stops.flatMap((stop) => stop.events),
    ]
  })
}

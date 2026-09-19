// The lifecycle events a Claude Subagent call reads as, and the facts each carries.
import type { SubagentEvent, ToolCall } from '@/domains/sessions/contract/transcript'

export function text(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key]
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

// The first line of a reply, with the Markdown marks a reader would not want stripped.
export function replyLine(reply: string): string | undefined {
  return reply
    .split('\n')
    .map((line) => line.replace(/[*_`#>]/g, '').trim())
    .find((line) => line.length > 0)
}

export function facts(call: ToolCall) {
  const name = text(call.input, 'description')
  const type = text(call.input, 'subagent_type')
  const model = text(call.input, 'model')
  return {
    ...(name === undefined ? {} : { name }),
    ...(type === undefined ? {} : { type }),
    ...(model === undefined ? {} : { model }),
  }
}

export function started(call: ToolCall, timestamp: string | null): SubagentEvent {
  return {
    kind: 'subagent',
    uuid: `${call.id}:started`,
    timestamp,
    subagentId: call.id,
    event: 'started',
    ...facts(call),
  }
}

export function responded(
  call: ToolCall,
  timestamp: string | null,
  ending: { state: 'completed' | 'failed' | 'interrupted'; reply: string | null },
): SubagentEvent {
  const line = ending.reply === null ? undefined : replyLine(ending.reply)
  return {
    kind: 'subagent',
    uuid: `${call.id}:responded`,
    timestamp,
    subagentId: call.id,
    event: 'responded',
    state: ending.state,
    ...facts(call),
    ...(ending.reply === null ? {} : { reply: ending.reply }),
    ...(line === undefined ? {} : { text: line }),
  }
}

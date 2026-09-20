// The lifecycle events a Claude Subagent call reads as, and the facts each carries.
import { elapsedMilliseconds } from '@/domains/sessions/contract/duration'
import type { SubagentControlFacts, SubagentEvent } from '@/domains/sessions/contract/transcript'

// The first line of a reply, with the Markdown marks a reader would not want stripped.
export function replyLine(reply: string): string | undefined {
  return reply
    .split('\n')
    .map((line) => line.replace(/[*_`#>]/g, '').trim())
    .find((line) => line.length > 0)
}

export function facts(call: SubagentControlFacts) {
  const name = call.name ?? undefined
  const type = call.type ?? undefined
  const model = call.model ?? undefined
  return {
    ...(name === undefined ? {} : { name }),
    ...(type === undefined ? {} : { type }),
    ...(model === undefined ? {} : { model }),
  }
}

export function started(
  call: SubagentControlFacts & { id: string },
  timestamp: string | null,
): SubagentEvent {
  return {
    kind: 'subagent',
    uuid: `${call.id}:started`,
    timestamp,
    subagentId: call.id,
    event: 'started',
    ...facts(call),
  }
}

export function responded({
  call,
  timestamp,
  startedAt,
  ending,
}: {
  call: SubagentControlFacts & { id: string }
  timestamp: string | null
  startedAt: string | null
  ending: { state: 'completed' | 'failed' | 'interrupted'; reply: string | null }
}): SubagentEvent {
  const line = ending.reply === null ? undefined : replyLine(ending.reply)
  const durationMs = elapsedMilliseconds(startedAt, timestamp)
  return {
    kind: 'subagent',
    uuid: `${call.id}:responded`,
    timestamp,
    subagentId: call.id,
    event: 'responded',
    state: ending.state,
    ...facts(call),
    ...(durationMs === null ? {} : { durationMs }),
    ...(ending.reply === null ? {} : { reply: ending.reply }),
    ...(line === undefined ? {} : { text: line }),
  }
}

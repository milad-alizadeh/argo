// Finds the Subagent a `SendMessage` or a stop call names, and reports it as an event.
import type { SubagentEvent, ToolCall } from '../../../domains/sessions/contract/transcript'
import { facts, responded, text } from './subagent-events'

// The Subagents a transcript has spawned and not yet ended, found by the id of the call, of its
// task, or by the name the call gave it.
export class Agents {
  private readonly open = new Map<string, ToolCall>()
  private readonly spawned = new Map<string, ToolCall>()
  private readonly tasks = new Map<string, string>()

  spawn(call: ToolCall) {
    this.open.set(call.id, call)
    this.spawned.set(call.id, call)
  }

  receipt(callId: string, taskId: string) {
    this.tasks.set(taskId, callId)
  }

  close(callId: string) {
    this.open.delete(callId)
  }

  get(callId: string) {
    return this.open.get(callId)
  }

  // A message can reach a Subagent that already responded, so it looks through every spawn.
  named(target: string, ended = false): ToolCall | undefined {
    const byTask = this.tasks.get(target)
    return [...(ended ? this.spawned : this.open).values()].find(
      (call) => call.id === target || call.id === byTask || text(call.input, 'name') === target,
    )
  }
}

// A `SendMessage`'s `to` is the agent's own name or the id of its task.
export function messaged(
  call: ToolCall,
  timestamp: string | null,
  agents: Agents,
): SubagentEvent[] {
  const target = text(call.input, 'to')
  const spawn = target === undefined ? undefined : agents.named(target, true)
  if (spawn === undefined) return []
  return [
    {
      kind: 'subagent',
      uuid: `${call.id}:messaged`,
      timestamp,
      subagentId: spawn.id,
      event: 'messaged',
      ...facts(spawn),
    },
  ]
}

// A stop call ends the Subagent it names as `interrupted` and draws no row of its own.
export function stopped(call: ToolCall, timestamp: string | null, agents: Agents): SubagentEvent[] {
  const target = text(call.input, 'task_id') ?? text(call.input, 'shell_id')
  const spawn = target === undefined ? undefined : agents.named(target)
  if (spawn === undefined) return []
  agents.close(spawn.id)
  return [responded(spawn, timestamp, { state: 'interrupted', reply: null })]
}

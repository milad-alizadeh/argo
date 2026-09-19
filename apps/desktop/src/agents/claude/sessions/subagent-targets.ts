// Finds the Subagent a `SendMessage` or a stop call names, and reports it as an event.
import type { SubagentControlFacts, SubagentEvent } from '@/domains/sessions/contract/transcript'
import { facts, responded } from './subagent-events'

type Control = SubagentControlFacts & { id: string }

// The Subagents a transcript has spawned and not yet ended, found by the id of the call, of its
// task, or by the name the call gave it.
export class Agents {
  private readonly open = new Map<string, Control>()
  private readonly spawned = new Map<string, Control>()
  private readonly tasks = new Map<string, string>()

  spawn(call: Control) {
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
  named(target: string, ended = false): Control | undefined {
    const byTask = this.tasks.get(target)
    return [...(ended ? this.spawned : this.open).values()].find(
      (call) => call.id === target || call.id === byTask || call.name === target,
    )
  }
}

// A `SendMessage`'s `to` is the agent's own name or the id of its task.
export function messaged(call: Control, timestamp: string | null, agents: Agents): SubagentEvent[] {
  const target = call.target
  const spawn = target === null ? undefined : agents.named(target, true)
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
export function stopped(call: Control, timestamp: string | null, agents: Agents): SubagentEvent[] {
  const target = call.target
  const spawn = target === null ? undefined : agents.named(target)
  if (spawn === undefined) return []
  agents.close(spawn.id)
  return [responded(spawn, timestamp, { state: 'interrupted', reply: null })]
}

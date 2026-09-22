import {
  type ClaudeSessionActor,
  projectionFrom,
} from '@/harnesses/claude/agent-sdk/claude-session-projection'

export function acceptedSessionOutcome(entry: { actor: ClaudeSessionActor; revision: number }) {
  return {
    kind: 'accepted' as const,
    projection: projectionFrom(entry.actor.getSnapshot(), entry.revision),
  }
}

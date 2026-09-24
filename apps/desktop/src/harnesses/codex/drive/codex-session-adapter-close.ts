import { setTimeout as delay } from 'node:timers/promises'
import type { SessionRegistry } from './session/codex-session-commands'
import type { ManagedSessionActor } from './session/codex-session-projection'
import type { CodexChannel } from './supervision/codex-channel'

// Quitting must not hang on an app-server that never answers the interrupt.
const CLOSING_INTERRUPT_MS = 5_000

// Killing app-server mid-Turn leaves the rollout's newest Turn open, and ADR-0040 reads such a
// rollout as running elsewhere for thirty minutes, so the next launch locks the reader out of a
// Session only this window ever drove. Interrupting first makes app-server end the Turn on disk.
async function endOpenTurn(channel: CodexChannel, threadId: string, turnId: string) {
  const interrupted = channel
    .request('turn/interrupt', { threadId, turnId }, () => undefined)
    .catch(() => undefined)
  await Promise.race([interrupted, delay(CLOSING_INTERRUPT_MS)])
}

function openTurnsIn(registry: SessionRegistry) {
  const turns: { threadId: string; turnId: string }[] = []
  for (const entry of registry.values()) {
    const { sessionId, turnId } = (entry.actor as ManagedSessionActor).getSnapshot().context
    if (sessionId !== null && turnId !== null) turns.push({ threadId: sessionId.nativeId, turnId })
  }
  return turns
}

export async function closeCodexSessionAdapter(
  held: { registry: SessionRegistry; supervisor: { getChannel: () => CodexChannel | null } },
  detach: () => void,
) {
  const { registry } = held
  const channel = held.supervisor.getChannel()
  if (channel !== null) {
    await Promise.all(
      openTurnsIn(registry).map((turn) => endOpenTurn(channel, turn.threadId, turn.turnId)),
    )
  }
  for (const entry of registry.values()) {
    entry.actor.stop()
  }
  detach()
}

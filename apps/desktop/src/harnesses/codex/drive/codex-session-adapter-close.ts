import type { SessionRegistry } from './session/codex-session-commands'
import type { ManagedSessionActor } from './session/codex-session-projection'
import type { ManagedSessionDeps } from './supervision/managed-session-machine'

export function closeCodexSessionAdapter(
  registry: SessionRegistry,
  sessionService: ManagedSessionDeps['sessionService'],
  detach: () => void,
) {
  for (const entry of registry.values()) {
    const session = (entry.actor as ManagedSessionActor).getSnapshot().context.sessionId
    if (session !== null) sessionService.release(session)
    entry.actor.stop()
  }
  detach()
}

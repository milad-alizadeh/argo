import type {
  SessionProjection,
  Unsubscribe,
} from '@/domains/sessions/next/contract/session-projection-contract'
import type { sharedAppServerRuntimeFor } from '../supervision/codex-shared-app-server-runtime'
import type { SessionRegistry } from './codex-session-commands'
import type { ManagedSessionActor } from './codex-session-projection'
import { projectionFrom } from './codex-session-projection'

export function registerCodexSessionActor(options: {
  actor: ManagedSessionActor
  appServer: ReturnType<typeof sharedAppServerRuntimeFor>
  registry: SessionRegistry
  notify: () => void
}) {
  const notify: Parameters<ManagedSessionActor['subscribe']>[0] = (snapshot) => {
    if (snapshot.context.sessionId === null) return
    const key = `${snapshot.context.sessionId.harness}:${snapshot.context.sessionId.nativeId}`
    let entry = options.registry.get(key)
    if (entry === undefined) {
      entry = {
        actor: options.actor,
        revision: 0,
        listeners: new Set(),
        sendQueue: Promise.resolve(),
      }
      options.registry.set(key, entry)
    }
    entry.revision += 1
    const projection = projectionFrom(snapshot, entry.revision)
    options.appServer.publish(projection)
    options.notify()
    for (const listener of entry.listeners) listener(projection)
  }
  options.actor.subscribe(notify)
  notify(options.actor.getSnapshot())
}

export function subscribeToCodexSession(options: {
  session: { harness: 'codex'; nativeId: string }
  onProjection: (projection: SessionProjection) => void
  registry: SessionRegistry
  appServer: ReturnType<typeof sharedAppServerRuntimeFor>
}): Unsubscribe | undefined {
  const entry = options.registry.get(`${options.session.harness}:${options.session.nativeId}`)
  if (entry === undefined) return options.appServer.observe(options.session, options.onProjection)
  entry.listeners.add(options.onProjection)
  return () => entry.listeners.delete(options.onProjection)
}

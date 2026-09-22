import type { ManagedSessionActor } from '@/harnesses/codex/drive/session/codex-session-projection'

function rejectionOf(actor: ManagedSessionActor): string {
  return actor.getSnapshot().context.lastSendRejection ?? 'Codex refused to resume this Session.'
}

export function waitForManaged(actor: ManagedSessionActor): Promise<void> {
  const ready = (snapshot: ReturnType<ManagedSessionActor['getSnapshot']>) =>
    snapshot.matches('Active')
  const refused = (snapshot: ReturnType<ManagedSessionActor['getSnapshot']>) =>
    snapshot.matches('Watched') || snapshot.matches('Failed')
  const initial = actor.getSnapshot()
  if (ready(initial)) return Promise.resolve()
  if (refused(initial)) return Promise.reject(new Error(rejectionOf(actor)))
  return new Promise((resolve, reject) => {
    const subscription = actor.subscribe((snapshot) => {
      if (ready(snapshot)) {
        subscription.unsubscribe()
        resolve()
      } else if (refused(snapshot)) {
        subscription.unsubscribe()
        reject(new Error(rejectionOf(actor)))
      }
    })
  })
}

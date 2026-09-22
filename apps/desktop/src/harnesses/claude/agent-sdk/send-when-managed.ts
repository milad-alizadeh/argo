import type { ClaudeSessionActor } from './claude-session-projection'

export function sendWhenManaged(actor: ClaudeSessionActor, prompt: string) {
  return new Promise<boolean>((resolve) => {
    const send = () => {
      actor.send({ type: 'Send', prompt })
      resolve(true)
    }
    if (actor.getSnapshot().matches('Managed')) return send()
    const subscription = actor.subscribe((snapshot) => {
      if (snapshot.matches('Managed')) {
        subscription.unsubscribe()
        send()
      } else if (snapshot.status === 'done') {
        subscription.unsubscribe()
        resolve(false)
      }
    })
  })
}

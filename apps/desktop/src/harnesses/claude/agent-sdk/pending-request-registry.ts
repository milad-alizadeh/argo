// Bridges the SDK's promise-returning `canUseTool`/`onUserDialog` callbacks (grounded in
// sdk.d.ts) to the actor's event-driven `Decide`/`Answer` events: the callback registers a
// pending resolver keyed by the SDK's own request id, and the matching event resolves it later,
// from a different tick.
export type PendingRequestRegistry<Value> = {
  register: (id: string) => Promise<Value>
  resolve: (id: string, value: Value) => void
  cancelAll: () => void
}

export function createPendingRequestRegistry<Value>(
  cancelledValue: Value,
): PendingRequestRegistry<Value> {
  const pending = new Map<string, (value: Value) => void>()

  return {
    register: (id) => new Promise((resolve) => pending.set(id, resolve)),
    resolve: (id, value) => {
      const resolve = pending.get(id)
      if (resolve === undefined) return
      pending.delete(id)
      resolve(value)
    },
    cancelAll: () => {
      for (const resolve of pending.values()) resolve(cancelledValue)
      pending.clear()
    },
  }
}

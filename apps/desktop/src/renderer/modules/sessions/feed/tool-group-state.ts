import { useCallback, useSyncExternalStore } from 'react'

type Listener = () => void

// Each mounted disclosure listens only to its own id, so opening one group avoids redrawing its neighbors.
export class ToolGroupState {
  private readonly listeners = new Map<string, Set<Listener>>()
  private readonly openIds = new Set<string>()

  isOpen(id: string) {
    return this.openIds.has(id)
  }

  setOpen(id: string, open: boolean) {
    if (this.openIds.has(id) === open) return
    if (open) this.openIds.add(id)
    else this.openIds.delete(id)
    for (const listener of this.listeners.get(id) ?? []) listener()
  }

  subscribe(id: string, listener: Listener) {
    const listeners = this.listeners.get(id) ?? new Set<Listener>()
    listeners.add(listener)
    this.listeners.set(id, listeners)
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) this.listeners.delete(id)
    }
  }
}

export function useToolGroupOpen(state: ToolGroupState, id: string) {
  const subscribe = useCallback((listener: Listener) => state.subscribe(id, listener), [id, state])
  const open = useSyncExternalStore(
    subscribe,
    () => state.isOpen(id),
    () => false,
  )
  const onOpenChange = useCallback((next: boolean) => state.setOpen(id, next), [id, state])
  return { onOpenChange, open }
}

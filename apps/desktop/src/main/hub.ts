import {
  applyEvent,
  type CockpitState,
  emptyState,
  type HubEvent,
  type ProjectionDelta,
} from '../shared'

// The main-process hub (ADR-0005): the single source of truth as a plain observable
// store. Events enter through one intake (`apply`); subscribers receive the deltas to
// project. Framework-free and Electron-free so it is pure and node-testable — the IPC
// transport (projectionBridge) is the only Electron-coupled layer on top.

export type ProjectionListener = (delta: ProjectionDelta) => void

export interface Hub {
  apply(event: HubEvent): void
  subscribe(listener: ProjectionListener): () => void
  getState(): CockpitState
}

export function createHub(): Hub {
  let state = emptyState()
  const listeners = new Set<ProjectionListener>()

  return {
    apply(event) {
      const result = applyEvent(state, event)
      state = result.state
      for (const delta of result.deltas) {
        for (const listener of listeners) listener(delta)
      }
    },
    subscribe(listener) {
      listeners.add(listener)
      // Hydrate the new subscriber with current truth before any live delta, so a
      // window that connects late (or reconnects) still renders the full rail.
      listener({ type: 'snapshot', state })
      return () => {
        listeners.delete(listener)
      }
    },
    getState() {
      return state
    },
  }
}

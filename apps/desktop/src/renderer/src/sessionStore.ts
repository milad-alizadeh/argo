import { applyDelta, type CockpitState, emptyState, type ProjectionDelta } from '@shared'
import { create } from 'zustand'

// The renderer's projection of main's authoritative state (ADR-0005). It holds no
// business logic — it only replays deltas through the shared `applyDelta`. The App
// container feeds it from the `window.cockpit` bridge.
export type { Cli, SessionStatus, SessionView } from '@shared'

interface SessionStore extends CockpitState {
  applyDelta: (delta: ProjectionDelta) => void
}

export const useSessionStore = create<SessionStore>((set) => ({
  ...emptyState(),
  applyDelta: (delta) => set((state) => applyDelta(state, delta)),
}))

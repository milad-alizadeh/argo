import { applyDelta, type CockpitState, emptyState, type ProjectionDelta } from '@shared'
import { create } from 'zustand'

// The renderer's projection of main's authoritative state (ADR-0005). It holds no
// business logic — it only replays deltas through the shared `applyDelta`. The App
// container feeds it from the `window.cockpit` bridge.

/** Which row each spawned Session took the place of once the CLI named it (#361). Kept beside the
 * projection rather than in it: main states the replacement in one delta and holds nothing, and
 * this is only what the renderer needs afterwards to keep a selection pointed at the same agent. */
type Successors = Record<string, string>

interface SessionStore extends CockpitState {
  successors: Successors
  applyDelta: (delta: ProjectionDelta) => void
}

/** The id a selection has to follow to. One hop: only the row Argo published before the CLI had
 * picked an id is ever replaced, and the Session that replaces it is never replaced again. */
export const currentSessionId = (successors: Successors, id: string | null): string | null =>
  id === null ? null : (successors[id] ?? id)

export const useSessionStore = create<SessionStore>((set) => ({
  ...emptyState(),
  successors: {},
  applyDelta: (delta) =>
    set((state) => ({
      ...applyDelta(state, delta),
      successors:
        delta.type === 'session-replaced'
          ? { ...state.successors, [delta.provisionalId]: delta.session.id }
          : state.successors,
    })),
}))

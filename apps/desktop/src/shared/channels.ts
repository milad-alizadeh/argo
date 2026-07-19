import type { ProjectionDelta } from './projection'

// IPC channel names for the main → renderer projection (ADR-0005). Shared so the
// send side (main) and the receive side (preload) can never disagree on the string.
export const PROJECTION_CHANNEL = 'cockpit:projection'
export const PROJECTION_READY_CHANNEL = 'cockpit:projection-ready'

// The preload bridge the renderer sees as `window.cockpit`. The renderer subscribes;
// main streams deltas (a snapshot first, then live patches).
export interface CockpitBridge {
  subscribeProjection(listener: (delta: ProjectionDelta) => void): () => void
}

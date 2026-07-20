// The projection contract shared by both processes (ADR-0005). Main reduces the
// event vocabulary into authoritative state (`applyEvent`) and emits deltas; the
// renderer replays those deltas into an identical projected state (`applyDelta`)
// with zero interpretation. Both sides run the SAME pure code here so the two
// copies can never drift.

import type { SessionStatus } from './sessionFacts'

export type Cli = 'claude' | 'codex'

// The rail-row view-model. Seam B will enrich this (honesty tiers, derived fields);
// for the skeleton it is the whole Session shape.
export interface SessionView {
  id: string
  title: string
  cli: Cli
  status: SessionStatus
}

// The event vocabulary the hub consumes (the Seam B → Seam A contract). One member
// for now; agent/run/phase/outcome events land with the adapter.
export type HubEvent = { type: 'session-created'; session: SessionView }

// The projected state the renderer renders.
export interface CockpitState {
  sessions: SessionView[]
}

// The deltas main pushes over IPC. `snapshot` hydrates a fresh subscriber (or a
// reconnecting one) with current truth; `session-added` is a live incremental patch.
export type ProjectionDelta =
  | { type: 'snapshot'; state: CockpitState }
  | { type: 'session-added'; session: SessionView }

export const emptyState = (): CockpitState => ({ sessions: [] })

function assertNever(value: never): never {
  throw new Error(`Unhandled discriminant: ${JSON.stringify(value)}`)
}

// Append a Session, idempotent on id: a re-observed Session returns the SAME state
// reference, which both reducers below use to decide "nothing changed".
function addSession(state: CockpitState, session: SessionView): CockpitState {
  if (state.sessions.some((existing) => existing.id === session.id)) return state
  return { sessions: [...state.sessions, session] }
}

// Authoritative intake (main side): fold one event into state and return the deltas
// to broadcast.
export function applyEvent(
  state: CockpitState,
  event: HubEvent,
): { state: CockpitState; deltas: ProjectionDelta[] } {
  switch (event.type) {
    case 'session-created': {
      const next = addSession(state, event.session)
      // A duplicate Session leaves state untouched and broadcasts nothing.
      const deltas: ProjectionDelta[] =
        next === state ? [] : [{ type: 'session-added', session: event.session }]
      return { state: next, deltas }
    }
  }
}

// Renderer-side projection: mechanically apply one delta. No business logic — the
// interpretation already happened in `applyEvent`.
export function applyDelta(state: CockpitState, delta: ProjectionDelta): CockpitState {
  switch (delta.type) {
    case 'snapshot':
      return delta.state
    case 'session-added':
      return addSession(state, delta.session)
    default:
      return assertNever(delta)
  }
}

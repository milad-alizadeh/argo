// The projection contract shared by both processes (ADR-0005). Main reduces the
// event vocabulary into authoritative state (`applyEvent`) and emits deltas; the
// renderer replays those deltas into an identical projected state (`applyDelta`)
// with zero interpretation. Both sides run the SAME pure code here so the two
// copies can never drift.

import {
  activateProject,
  addProject,
  addSession,
  attribute,
  type CockpitState,
  repointProject,
  type SessionIntake,
  type SessionView,
  updateSession,
} from './cockpitState'
import type { ProjectView } from './projects'

// The event vocabulary the hub consumes (the Seam B → Seam A contract). Sessions are
// observed; Projects are registered — the one entity above the Session that Argo owns.
// Observation is incremental: `session-created` announces a Session the roster has never
// seen, `session-updated` carries a later reading of one it has, so a live Session changes
// without the sweep that found it running again.
export type HubEvent =
  | { type: 'session-created'; session: SessionIntake }
  | { type: 'session-updated'; session: SessionIntake }
  | { type: 'project-registered'; project: ProjectView }
  | { type: 'project-relocated'; id: string; path: string }
  | { type: 'project-activated'; id: string }

export type SessionCreated = Extract<HubEvent, { type: 'session-created' }>
export type SessionUpdated = Extract<HubEvent, { type: 'session-updated' }>

// The deltas main pushes over IPC. `snapshot` hydrates a fresh subscriber (or a
// reconnecting one) with current truth; the rest are live incremental patches.
export type ProjectionDelta =
  | { type: 'snapshot'; state: CockpitState }
  | { type: 'session-added'; session: SessionView }
  | { type: 'session-changed'; session: SessionView }
  | { type: 'project-added'; project: ProjectView }
  | { type: 'project-path-changed'; id: string; path: string }
  | { type: 'active-project-changed'; id: string }

function assertNever(value: never): never {
  throw new Error(`Unhandled discriminant: ${JSON.stringify(value)}`)
}

// Authoritative intake (main side): fold one event into state and return the deltas to
// broadcast. It reduces through `applyDelta` rather than beside it, so main's copy and the
// renderer's are produced by one code path and cannot diverge. A no-op event (a re-observed
// Session, an unknown Project) leaves state untouched and broadcasts nothing.
export function applyEvent(
  state: CockpitState,
  event: HubEvent,
): { state: CockpitState; deltas: ProjectionDelta[] } {
  const delta = toDelta(state, event)
  const next = applyDelta(state, delta)
  return next === state ? { state, deltas: [] } : { state: next, deltas: [delta] }
}

// The one place a Session is attributed to a Project, so the delta the renderer replays
// already carries the answer (ADR-0015: attribution is resolved from cwd, never chosen).
function toDelta(state: CockpitState, event: HubEvent): ProjectionDelta {
  switch (event.type) {
    case 'session-created':
      return { type: 'session-added', session: attribute(state.projects, event.session) }
    case 'session-updated':
      return { type: 'session-changed', session: attribute(state.projects, event.session) }
    case 'project-registered':
      return { type: 'project-added', project: event.project }
    case 'project-relocated':
      return { type: 'project-path-changed', id: event.id, path: event.path }
    case 'project-activated':
      return { type: 'active-project-changed', id: event.id }
    default:
      return assertNever(event)
  }
}

// Renderer-side projection: mechanically apply one delta. No business logic — the
// interpretation already happened in `toDelta`.
export function applyDelta(state: CockpitState, delta: ProjectionDelta): CockpitState {
  switch (delta.type) {
    case 'snapshot':
      return delta.state
    case 'session-added':
      return addSession(state, delta.session)
    case 'session-changed':
      return updateSession(state, delta.session)
    case 'project-added':
      return addProject(state, delta.project)
    case 'project-path-changed':
      return repointProject(state, delta.id, delta.path)
    case 'active-project-changed':
      return activateProject(state, delta.id)
    default:
      return assertNever(delta)
  }
}

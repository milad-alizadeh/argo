import { type ProjectView, projectView } from '../../projects/model'
import { sessionFacts } from '../../session/facts'
import { type CockpitState, emptyState, type SessionIntake } from '../cockpitState'
import { applyDelta, applyEvent, type HubEvent } from '../projection'

// The whole projection contract driven end to end: main-side `applyEvent` turns events into
// deltas, renderer-side `applyDelta` replays those deltas, and both copies are handed back so a
// case can assert they agree. Shared by the projection's test files, which split by subject.

export function replay(events: HubEvent[]): { hub: CockpitState; projected: CockpitState } {
  let hub = emptyState()
  let projected = emptyState()
  for (const event of events) {
    const result = applyEvent(hub, event)
    hub = result.state
    for (const delta of result.deltas) projected = applyDelta(projected, delta)
  }
  return { hub, projected }
}

export const session = (over: Partial<SessionIntake> = {}): SessionIntake => ({
  id: 's1',
  title: 'Refactor auth module',
  cli: 'claude',
  cwd: null,
  model: null,
  branch: null,
  lastActivityAt: null,
  posture: 'external',
  facts: sessionFacts(),
  agents: [],
  ...over,
})

export const argo: ProjectView = projectView({ id: 'p-argo', path: '/Users/dev/code/argo' })
export const shop: ProjectView = projectView({ id: 'p-shop', path: '/Users/dev/code/shop' })

export const registered = (project: ProjectView): HubEvent => ({
  type: 'project-registered',
  project,
})
export const created = (over: Partial<SessionIntake> = {}): HubEvent => ({
  type: 'session-created',
  session: session(over),
})

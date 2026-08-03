import { sessionFacts } from '../shared'
import type { Hub } from './hub'

// Opt-in synthetic world (gated on ARGO_SEED_DEMO) that visibly exercises the projection
// pipeline (hub → IPC → Zustand → chrome and roster) before Seam B observes real Sessions.
// It seeds a Project as well as a Session: the shell renders honestly empty with no Project
// registered, so a Session alone would project into a stage showing the connect seam.
// Nothing real is observed yet — delete this when the session adapter lands.

const DEMO_PROJECT = { id: 'demo-project-1', name: 'argo', path: '/tmp/argo-demo' }

export function seedDemoSession(hub: Hub): void {
  hub.apply({ type: 'project-registered', project: DEMO_PROJECT })
  hub.apply({ type: 'project-activated', id: DEMO_PROJECT.id })
  hub.apply({
    type: 'session-created',
    session: {
      id: 'demo-claude-1',
      title: 'Refactor auth module',
      cli: 'claude',
      cwd: DEMO_PROJECT.path,
      facts: sessionFacts({ status: 'running' }),
    },
  })
}

import { sessionFacts } from '../shared'
import type { Hub } from './hub'

// Opt-in synthetic Session (gated on ARGO_SEED_DEMO) that visibly exercises the
// projection pipeline (hub → IPC → Zustand → rail) before Seam B observes real
// Sessions. Nothing real is observed yet — delete this when the session adapter lands.
export function seedDemoSession(hub: Hub): void {
  hub.apply({
    type: 'session-created',
    session: {
      id: 'demo-claude-1',
      title: 'Refactor auth module',
      cli: 'claude',
      facts: sessionFacts({ status: 'running' }),
    },
  })
}

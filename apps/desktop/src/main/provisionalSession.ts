import { type SessionIntake, sessionFacts } from '../shared'
import { SPAWN_CLI } from './agentLauncher'
import type { ClaimId } from './observe'

// The row Argo publishes for an agent it has just STARTED, before the CLI has written a record.
// Waiting for the transcript would render a DIRECT fact — Argo owns this claim and its pty — at the
// DERIVED tier's latency, leaving the roster silent about the one Session it knows for certain
// (#361). Everything the record has not said yet is absent rather than defaulted: no model, no
// branch, no runtime tree.

/** Its id IS the claim's, because that is the only handle both halves share until the CLI picks
 * one: the Dock resolves attach → claim → pty through the same lookup, and the observation that
 * finally names the Session reports this claim so the row can stand down (`ManagedSessions.bind`). */
export function provisionalSession(
  claim: ClaimId,
  cwd: string,
  spawnedAtMs: number,
): SessionIntake {
  return {
    id: claim,
    title: 'New session',
    cli: SPAWN_CLI,
    cwd,
    model: null,
    branch: null,
    lastActivityAt: spawnedAtMs,
    posture: 'managed',
    // Idle, not running: the agent is up and has been asked nothing, which is the state that hands
    // the next move back to you — and is exactly what the Dock is for.
    facts: sessionFacts({ status: 'idle', agent: 'idle' }),
    agents: [],
  }
}

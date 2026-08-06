import { type Cli, type SessionIntake, sessionFacts } from '../../shared'
import type { ClaimId } from '../observe'

// The row Argo publishes for an agent it has just STARTED, before the CLI has written a record.
// Waiting for the transcript would render a DIRECT fact — Argo owns this claim and its pty — at the
// DERIVED tier's latency, leaving the roster silent about the one Session it knows for certain
// (#361). Everything the record has not said yet is absent rather than defaulted: no model, no
// branch, no runtime tree.

/** What Argo just started: the claim it holds, where it runs, which program it is, and when.
 * One structure rather than four positionals, so no call site encodes the order. */
export interface AgentSpawn {
  claim: ClaimId
  cwd: string
  cli: Cli
  spawnedAtMs: number
}

/** Its id IS the claim's, because that is the only handle both halves share until the CLI picks
 * one: the Dock resolves attach → claim → pty through the same lookup, and the observation that
 * finally names the Session reports this claim so the row can stand down (`ManagedSessions.bind`). */
export function provisionalSession({ claim, cwd, cli, spawnedAtMs }: AgentSpawn): SessionIntake {
  return {
    id: claim,
    title: 'New session',
    cli,
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

/** How the pty went away, as node-pty reports it. A CLI that is not on the PATH does NOT throw on
 * macOS — the child is forked and dies, so this exit is the only account there is of it. */
export interface AgentExit {
  claim: ClaimId
  cwd: string
  cli: Cli
  endedAtMs: number
  exitCode: number
}

/**
 * That same row once its pty has exited without the CLI ever writing a record — a spawn quit, or an
 * agent that died at startup. It is the ONE row no observation can reach: there is no transcript,
 * so the sweep will never correct it. Ownership dies with the pty and cannot be re-adopted
 * (CONTEXT.md L2), so it demotes to orphaned and ends, rather than standing managed-and-idle over a
 * pty that is gone — a false DIRECT the roster would keep forever.
 *
 * The row says WHICH way it went, because a spawn that dies at startup would otherwise appear and
 * archive itself without a word — the same silence #361 set out to end.
 */
export function endedSession({ claim, cwd, cli, endedAtMs, exitCode }: AgentExit): SessionIntake {
  return {
    ...provisionalSession({ claim, cwd, cli, spawnedAtMs: endedAtMs }),
    title: exitCode === 0 ? `${cli} exited` : `${cli} exited (code ${exitCode})`,
    posture: 'orphaned',
    facts: sessionFacts({ status: 'ended', agent: 'idle' }),
  }
}

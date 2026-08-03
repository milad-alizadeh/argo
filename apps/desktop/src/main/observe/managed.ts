import { type SessionPosture, sessionPosture } from '../../shared'

// Which Sessions Argo OWNS, for this Argo process only (CONTEXT.md L2, ADR-0013). Managed-ness
// is not durable: the PTY dies with the owning Argo process and cannot be re-adopted, so this
// registry is deliberately in-memory — a restart re-observes its own sessions as `external`
// rather than re-claiming an ownership it no longer has.
//
// The key is the spawn CWD, not a session id: the CLI writes its transcript (and picks its id)
// after the spawn returns, so cwd is the only thing both sides of the spawn know. It is the same
// coarse key the liveness probe uses, with the same caveat — two agents in one folder are
// indistinguishable — which is why nothing here claims more than a posture.

export interface ManagedSessions {
  /** Argo spawned an agent in this folder and holds its PTY. */
  claim(cwd: string): void
  /** The PTY exited: ownership is gone and cannot come back. */
  release(cwd: string): void
  /** managed while the PTY lives, orphaned once it dies, external if Argo never spawned here. */
  postureFor(cwd: string | null): SessionPosture
}

export function createManagedSessions(): ManagedSessions {
  const claimed = new Set<string>()
  const liveByCwd = new Map<string, number>()

  return {
    claim(cwd) {
      claimed.add(cwd)
      liveByCwd.set(cwd, (liveByCwd.get(cwd) ?? 0) + 1)
    },
    release(cwd) {
      const remaining = (liveByCwd.get(cwd) ?? 0) - 1
      if (remaining > 0) liveByCwd.set(cwd, remaining)
      else liveByCwd.delete(cwd)
    },
    postureFor(cwd) {
      if (cwd === null || !claimed.has(cwd)) return 'external'
      return sessionPosture('managed', liveByCwd.has(cwd))
    },
  }
}

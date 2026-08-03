import { type SessionPosture, sessionPosture } from '../../shared'

// Which Sessions Argo OWNS, for this Argo process only (CONTEXT.md L2, ADR-0013). Managed-ness
// is not durable: the PTY dies with the owning Argo process and cannot be re-adopted, so this
// registry is deliberately in-memory — a restart re-observes its own sessions as `external`
// rather than re-claiming an ownership it no longer has.
//
// A claim is keyed by spawn folder AND the window the PTY was alive for, because the CLI picks
// its own session id after the spawn returns: cwd alone is not a key, and on cwd alone a
// pre-existing agent in the same folder would read as ours and earn a fact it has not earned.
// A Session belongs to a claim only if its transcript STARTED inside that claim's window.

interface Claim {
  fromMs: number
  /** null while the PTY lives; the moment it exited otherwise. */
  toMs: number | null
}

export interface ManagedSessions {
  /** Argo spawned an agent in this folder and holds its PTY. */
  claim(cwd: string): void
  /** The PTY exited: ownership is gone and cannot come back. */
  release(cwd: string): void
  /**
   * managed while the claim's PTY lives, orphaned once it has exited, external for a Session no
   * claim covers — including one that was already running in a folder Argo later spawned into.
   */
  postureFor(cwd: string | null, startedAtMs: number | null): SessionPosture
}

export function createManagedSessions(now: () => number = Date.now): ManagedSessions {
  const claimsByCwd = new Map<string, Claim[]>()

  return {
    claim(cwd) {
      claimsByCwd.set(cwd, [...(claimsByCwd.get(cwd) ?? []), { fromMs: now(), toMs: null }])
    },
    release(cwd) {
      const claims = claimsByCwd.get(cwd)
      const open = claims?.findLast((claim) => claim.toMs === null)
      if (open) open.toMs = now()
    },
    postureFor(cwd, startedAtMs) {
      if (cwd === null || startedAtMs === null) return 'external'
      const owning = claimsByCwd
        .get(cwd)
        ?.find(
          (claim) =>
            startedAtMs >= claim.fromMs && (claim.toMs === null || startedAtMs <= claim.toMs),
        )
      if (!owning) return 'external'
      return sessionPosture('managed', owning.toMs === null)
    },
  }
}

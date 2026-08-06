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
//
// That same match is what lets a Dock reach the agent it is drawn for (#323): the observer BINDS
// each Session to the claim that owns it, and the claim id is the handle main's terminal bridge
// looks the agent's PTY up by (`agentTerminals`). The id stays opaque here — this registry grades
// ownership and never holds a PTY.

/** Handle on one act of ownership: what `claim` returns, `release` closes and a Session binds to. */
export type ClaimId = string

interface Claim {
  id: ClaimId
  fromMs: number
  /** null while the PTY lives; the moment it exited otherwise. */
  toMs: number | null
}

export interface ManagedSessions {
  /** Argo spawned an agent in this folder and holds its PTY. */
  claim(cwd: string): ClaimId
  /** The PTY exited: ownership is gone and cannot come back. */
  release(id: ClaimId): void
  /**
   * managed while the claim's PTY lives, orphaned once it has exited, external for a Session no
   * claim covers — including one that was already running in a folder Argo later spawned into.
   */
  postureFor(cwd: string | null, startedAtMs: number | null): SessionPosture
  /**
   * Record which claim owns an observed Session, now that it HAS an id. Only the observer can do
   * this — the spawn knew a folder, the transcript knows the id, and this is where the two meet.
   * A Session no claim covers binds to nothing rather than to the nearest claim.
   */
  bind(sessionId: string, cwd: string | null, startedAtMs: number | null): void
  /**
   * Argo started an agent FOR an already-observed Session, because its Dock had no PTY to attach
   * to. The Session's POSTURE does not change — this claim's agent is a new one, not the agent
   * that wrote that transcript — but the Dock now has something to steer.
   */
  adopt(sessionId: string, claim: ClaimId): void
  /** The live claim whose agent PTY this Session steers; `null` when there is none. */
  ownerOf(sessionId: string): ClaimId | null
}

export function createManagedSessions(now: () => number = Date.now): ManagedSessions {
  const claimsByCwd = new Map<string, Claim[]>()
  const claimsById = new Map<ClaimId, Claim>()
  const boundSessions = new Map<string, ClaimId>()
  let issued = 0

  // The NEWEST claim whose window contains the start, not the first: ⌘N twice in one project opens
  // two claims on the same folder with overlapping windows, and the older one's window never
  // closes while its agent lives — so first-match would bind both Sessions to the first agent and
  // both Docks would steer it.
  const owningClaim = (cwd: string | null, startedAtMs: number | null): Claim | undefined => {
    if (cwd === null || startedAtMs === null) return undefined
    return claimsByCwd
      .get(cwd)
      ?.findLast(
        (claim) =>
          startedAtMs >= claim.fromMs && (claim.toMs === null || startedAtMs <= claim.toMs),
      )
  }

  return {
    claim(cwd) {
      issued += 1
      const claim: Claim = { id: `claim-${issued}`, fromMs: now(), toMs: null }
      claimsByCwd.set(cwd, [...(claimsByCwd.get(cwd) ?? []), claim])
      claimsById.set(claim.id, claim)
      return claim.id
    },
    release(id) {
      const claim = claimsById.get(id)
      if (claim && claim.toMs === null) claim.toMs = now()
    },
    postureFor(cwd, startedAtMs) {
      const owning = owningClaim(cwd, startedAtMs)
      if (owning === undefined) return 'external'
      return sessionPosture('managed', owning.toMs === null)
    },
    bind(sessionId, cwd, startedAtMs) {
      // Only ever ADDS: a Session no claim covers keeps whatever `adopt` gave it, so the observer's
      // next publish does not tear the agent out from under an open Dock.
      const owning = owningClaim(cwd, startedAtMs)
      if (owning !== undefined) boundSessions.set(sessionId, owning.id)
    },
    adopt(sessionId, claim) {
      boundSessions.set(sessionId, claim)
    },
    ownerOf(sessionId) {
      const id = boundSessions.get(sessionId)
      if (id === undefined) return null
      // A released claim has no PTY left, so an orphaned Session steers nothing — the same answer
      // its posture gives, from the same fact.
      return claimsById.get(id)?.toMs === null ? id : null
    },
  }
}

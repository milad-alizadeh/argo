import Foundation

/// Which Sessions Argo OWNS, for this Argo process only (CONTEXT.md L2, ADR-0013).
///
/// Managed-ness is not durable: the PTY dies with the owning Argo and cannot be re-adopted, so this
/// registry is in-memory. A restart re-observes its own Sessions as `external`.
///
/// A claim is keyed by spawn folder AND the window the PTY was alive for, because a CLI picks its
/// own session id after the spawn returns: on the folder alone, an agent already running there
/// would read as ours.
///
/// The folder is held RESOLVED (#363). The two sides spell it differently — Argo claims the path
/// the user registered, and the CLI records the one it reached through `/var` → `/private/var` —
/// so an unresolved key grades a Session Argo spawned and holds the PTY for as `external`.
@MainActor
public final class SessionOwnership {
    /// Handle on one act of ownership. Its `value` is also the id the roster carries for the row
    /// published at spawn — until the CLI picks a Session id it is the only shared handle.
    public struct ClaimID: Hashable, Sendable {
        public let value: String
    }

    struct Claim {
        let cwd: String
        let fromMs: Int
        /// `nil` while the PTY lives; the moment it exited otherwise.
        var toMs: Int?
        /// The Session the CLI turned out to be running under, once its record named one.
        var sessionID: String?
    }

    /// Main-actor isolated like the registry itself, so a test can hand it a clock it moves by hand
    /// without promising the concurrency checker anything about a value only this actor touches.
    private let now: () -> Int
    var claims: [ClaimID: Claim] = [:]
    /// The order claims were issued in — "the newest claim still waiting for a Session" is the
    /// tie-break, and a dictionary has no order to ask.
    var issuedOrder: [ClaimID] = []
    var boundSessions: [String: ClaimID] = [:]
    private var issued = 0

    public init(now: @escaping () -> Int = { Date().epochMs }) {
        self.now = now
    }

    /// Argo spawned an agent in this folder and holds its PTY.
    public func claim(cwd: String) -> ClaimID {
        issued += 1
        let id = ClaimID(value: "claim-\(issued)")
        claims[id] = Claim(cwd: resolvedPath(cwd), fromMs: now(), toMs: nil, sessionID: nil)
        issuedOrder.append(id)
        // Reachable under its own id from birth: the roster carries a row for this agent before the
        // CLI has picked a Session id (#361), and that row's terminal is looked up the same way.
        boundSessions[id.value] = id
        return id
    }

    /// The PTY exited: ownership is gone and cannot come back.
    public func release(_ id: ClaimID) {
        guard claims[id]?.toMs == nil else { return }
        claims[id]?.toMs = now()
    }

    /// Every claim whose PTY is still alive, oldest first — what app quit has to shut down.
    var liveClaims: [ClaimID] {
        issuedOrder.filter { claims[$0]?.toMs == nil }
    }

    /// `managed` while the covering claim's PTY lives, `orphaned` once it has exited, `external`
    /// for a Session no claim covers — including one already running in a folder Argo later
    /// spawned into, and one Argo cannot place for want of a cwd or a start time.
    public func provenance(cwd: String?, startedAtMs: Int?) -> SessionProvenance {
        guard let id = claimFor(cwd: cwd, startedAtMs: startedAtMs) else { return .external }
        return claims[id]?.toMs == nil ? .managed : .orphaned
    }

    /// The claim a Session belongs to, or nothing. The claim still WAITING for a Session wins, and
    /// the newest of those: spawning twice in one folder opens two claims with overlapping windows,
    /// so matching on the window alone would hand both Sessions the same agent.
    func claimFor(cwd: String?, startedAtMs: Int?) -> ClaimID? {
        let covering = covering(cwd: cwd, startedAtMs: startedAtMs)
        return covering.last { claims[$0]?.sessionID == nil } ?? covering.last
    }

    private func covering(cwd: String?, startedAtMs: Int?) -> [ClaimID] {
        guard let cwd, let startedAtMs else { return [] }
        let resolved = resolvedPath(cwd)
        return issuedOrder.filter { id in
            guard let claim = claims[id] else { return false }
            return claim.cwd == resolved
                && startedAtMs >= claim.fromMs
                && startedAtMs <= (claim.toMs ?? .max)
        }
    }
}

import Foundation

/// Which Sessions Argo OWNS, for this Argo process only (CONTEXT.md L2, ADR-0013).
///
/// Managed-ness is not durable: the PTY dies with the owning Argo and cannot be re-adopted, so this
/// registry is deliberately in-memory. A restart re-observes its own Sessions as `external` rather
/// than re-claiming an ownership it no longer has.
///
/// A claim is keyed by spawn folder AND the window the PTY was alive for, because a CLI picks its
/// own session id after the spawn returns: on the folder alone, an agent already running there
/// would read as ours and earn a posture it has not earned.
@MainActor
public final class SessionOwnership {
    public struct ClaimID: Hashable, Sendable {
        fileprivate let number: Int
    }

    private struct Claim {
        let cwd: String
        let fromMs: Int
        /// `nil` while the PTY lives; the moment it exited otherwise.
        var toMs: Int?
    }

    /// Main-actor isolated like the registry itself, so a test can hand it a clock it moves by hand
    /// without promising the concurrency checker anything about a value only this actor touches.
    private let now: () -> Int
    private var claims: [ClaimID: Claim] = [:]
    private var issued = 0

    public init(now: @escaping () -> Int = { Int(Date().timeIntervalSince1970 * 1000) }) {
        self.now = now
    }

    /// Argo spawned an agent in this folder and holds its PTY.
    public func claim(cwd: String) -> ClaimID {
        issued += 1
        let id = ClaimID(number: issued)
        claims[id] = Claim(cwd: cwd, fromMs: now(), toMs: nil)
        return id
    }

    /// The PTY exited: ownership is gone and cannot come back.
    public func release(_ id: ClaimID) {
        guard claims[id]?.toMs == nil else { return }
        claims[id]?.toMs = now()
    }

    /// `managed` while a covering claim's PTY lives, `orphaned` once every one of them has exited,
    /// and `external` for a Session no claim covers — including one that was already running in a
    /// folder Argo later spawned into.
    ///
    /// A Session Argo cannot place — no working directory read, or no time in its records — is
    /// external by the same rule the whole registry runs on: an unprovable claim is not a claim.
    public func provenance(cwd: String?, startedAtMs: Int?) -> SessionProvenance {
        let covering = covering(cwd: cwd, startedAtMs: startedAtMs)
        guard !covering.isEmpty else { return .external }
        return covering.contains { $0.toMs == nil } ? .managed : .orphaned
    }

    private func covering(cwd: String?, startedAtMs: Int?) -> [Claim] {
        guard let cwd, let startedAtMs else { return [] }
        return claims.values.filter { claim in
            claim.cwd == cwd && startedAtMs >= claim.fromMs && startedAtMs <= (claim.toMs ?? .max)
        }
    }
}

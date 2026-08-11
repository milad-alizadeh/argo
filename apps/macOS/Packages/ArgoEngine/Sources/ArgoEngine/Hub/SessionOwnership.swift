import Foundation

/// Which Sessions Argo OWNS, for this Argo process only (CONTEXT.md L2, ADR-0013).
///
/// The PTY dies with the owning Argo and cannot be re-adopted, so the claims are in-memory. What a
/// restart keeps is the LEDGER beside them: a Session this Argo never claimed but a previous one
/// did grades `orphaned` rather than `external`, and can be resumed (ADR-0026).
///
/// A claim is keyed by spawn folder AND the window the PTY was alive for, because a CLI picks its
/// own session id after the spawn returns: on the folder alone, an agent already running there
/// would read as ours. A RESUME needs neither key — it knows the Session before the process
/// exists, so its claim is bound to that id from birth.
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
    let now: () -> Int
    /// What every Argo before this one owned, and the file it came out of.
    var ledger: SessionOwnershipLedger
    let ledgerStore: SessionOwnershipLedgerStore
    var claims: [ClaimID: Claim] = [:]
    /// The order claims were issued in — "the newest claim still waiting for a Session" is the
    /// tie-break, and a dictionary has no order to ask.
    var issuedOrder: [ClaimID] = []
    var boundSessions: [String: ClaimID] = [:]
    private var issued = 0

    /// A store with no file remembers nothing, which is the honest default for a test and for the
    /// render harness: neither may read or write the machine's own ledger.
    public init(
        now: @escaping () -> Int = { Date().epochMs },
        ledgerStore: SessionOwnershipLedgerStore = SessionOwnershipLedgerStore(fileURL: nil),
    ) {
        self.now = now
        self.ledgerStore = ledgerStore
        self.ledger = ledgerStore.load()
    }

    /// Argo spawned an agent in this folder and holds its PTY.
    public func claim(cwd: String) -> ClaimID {
        open(cwd: cwd, resuming: nil)
    }

    /// Argo started a CLI on an EXISTING chain, so the claim names its Session from birth rather
    /// than being matched back by folder and start time. The id is known before the process is, so
    /// there is nothing to guess (#10, and it sidesteps #363/#364 entirely).
    public func claim(cwd: String, resuming sessionID: String) -> ClaimID {
        open(cwd: cwd, resuming: sessionID)
    }

    /// The PTY exited: this claim is over. The ledger keeps the fact that Argo held it, which is
    /// what a later launch grades `orphaned` on.
    public func release(_ id: ClaimID) {
        guard claims[id]?.toMs == nil else { return }
        claims[id]?.toMs = now()
        guard let sessionID = claims[id]?.sessionID else { return }
        recordRelease(of: sessionID)
    }

    /// Every claim whose PTY is still alive, oldest first — what app quit has to shut down.
    var liveClaims: [ClaimID] {
        issuedOrder.filter { claims[$0]?.toMs == nil }
    }

    /// `managed` while the claim's PTY lives, `orphaned` once it has exited or once the Argo that
    /// held it is gone, `external` for a Session no Argo ever owned — including one already running
    /// in a folder Argo later spawned into, and one Argo cannot place for want of a cwd or a start
    /// time.
    ///
    /// The named Session is tried first, because a resume's claim covers no window a transcript
    /// could be matched against: the chain started long before the claim did.
    public func provenance(
        sessionID: String?,
        cwd: String?,
        startedAtMs: Int?,
    )
        -> SessionProvenance {
        if let bound = sessionID.flatMap({ boundSessions[$0] }) ?? claimFor(
            cwd: cwd,
            startedAtMs: startedAtMs,
        ) {
            return claims[bound]?.toMs == nil ? .managed : .orphaned
        }
        // No claim in THIS process, so the ledger is the only witness left. `external` means never
        // Argo's, which would be a false claim about a Session it spawned before the last quit.
        guard let sessionID, hasEverOwned(sessionID: sessionID) else { return .external }
        return .orphaned
    }

    /// The claim a Session belongs to, or nothing. The claim still WAITING for a Session wins, and
    /// the newest of those: spawning twice in one folder opens two claims with overlapping windows,
    /// so matching on the window alone would hand both Sessions the same agent.
    func claimFor(cwd: String?, startedAtMs: Int?) -> ClaimID? {
        let covering = covering(cwd: cwd, startedAtMs: startedAtMs)
        return covering.last { claims[$0]?.sessionID == nil } ?? covering.last
    }

    private func open(cwd: String, resuming sessionID: String?) -> ClaimID {
        issued += 1
        let id = ClaimID(value: "claim-\(issued)")
        claims[id] = Claim(cwd: resolvedPath(cwd), fromMs: now(), toMs: nil, sessionID: sessionID)
        issuedOrder.append(id)
        // Reachable under its own id from birth: the roster carries a row for this agent before the
        // CLI has picked a Session id (#361), and that row's terminal is looked up the same way.
        boundSessions[id.value] = id
        guard let sessionID else { return id }
        boundSessions[sessionID] = id
        recordOwnership(of: sessionID)
        return id
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

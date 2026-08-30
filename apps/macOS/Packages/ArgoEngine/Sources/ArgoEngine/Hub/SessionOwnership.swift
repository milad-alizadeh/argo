import Foundation

/// Which Sessions Argo OWNS, for this Argo process only (CONTEXT.md L2, ADR-0013).
///
/// The PTY dies with the owning Argo and cannot be re-adopted, so the claims are in-memory. What a
/// restart keeps is the LEDGER beside them: a Session this Argo never claimed but a previous one
/// did grades `orphaned` rather than `external`, and can be resumed (ADR-0026).
///
/// Every claim NAMES its Session, and nothing here is matched back by folder and start time
/// (#742). A resume knows the roster id before the process exists, and a fresh `claude` is handed
/// the transcript id to write under (`--session-id`), so that claim knows its Session from birth
/// too. A guess is the one thing this file must not make: an agent somebody else started in the
/// same folder answers a guess just as well as ours.
@MainActor
public final class SessionOwnership {
    /// Handle on one act of ownership. Its `value` is also the id the roster carries for the row
    /// published at spawn — until the transcript appears it is the only shared handle.
    public struct ClaimID: Hashable, Sendable {
        public let value: String
    }

    struct Claim {
        let fromMs: Int
        /// `nil` while the PTY lives; the moment it exited otherwise.
        var toMs: Int?
        /// The Session as the ROSTER keys it, which is its transcript's path. Known from birth for
        /// a resume, and learned at `bind` for a fresh spawn — the file does not exist yet.
        var sessionID: String?
        /// The transcript id Argo told a fresh CLI to write under, and the exact key `bind` matches
        /// on. Absent for a resume, which has its roster id already, and for a CLI that cannot be
        /// told (`AgentCLI.namesFreshSession`).
        let namedUUID: String?
        /// The Ticket the spawn named for this claim (#894). Here rather than straight in the
        /// ledger because a fresh CLI has no Session id yet, and the file is keyed by one.
        var ticket: Int?
    }

    /// Main-actor isolated like the registry itself, so a test can hand it a clock it moves by hand
    /// without promising the concurrency checker anything about a value only this actor touches.
    let now: () -> Int
    /// What every Argo before this one owned, and the file it came out of.
    var ledger: SessionOwnershipLedger {
        didSet { revision += 1 }
    }

    let ledgerStore: SessionOwnershipLedgerStore
    /// Which registry this is, written into every ledger window it opens, so another cockpit window
    /// reading the file can tell that Session is already being steered.
    let owner: SessionOwnershipLedger.Owner
    var claims: [ClaimID: Claim] = [:] {
        didSet { revision += 1 }
    }

    /// The order claims were issued in, which is the order `claimNaming` reads them in — a
    /// dictionary has none to ask.
    var issuedOrder: [ClaimID] = [] {
        didSet { revision += 1 }
    }

    var boundSessions: [String: ClaimID] = [:] {
        didSet { revision += 1 }
    }

    private var issued = 0
    /// Bumped by every write to the four stored facts above, through their own observers rather
    /// than by hand — so a claim opened, bound, released or written down cannot reach the ledger
    /// without reaching the roster's memo too (`HubRosterMemo`).
    ///
    /// Not `@Observable`, because this type is not: what a claim changes about a row has always
    /// arrived at the cockpit alongside a spawn or a claim-ledger publish, and the memo keeps it
    /// that way rather than growing a second way in.
    private(set) var revision = 0

    /// A store with no file remembers nothing, which is the honest default for a test and for the
    /// render harness: neither may read or write the machine's own ledger.
    init(
        now: @escaping () -> Int = { Date().epochMs },
        ledgerStore: SessionOwnershipLedgerStore = SessionOwnershipLedgerStore(fileURL: nil),
        owner: SessionOwnershipLedger.Owner = .thisRegistry,
    ) {
        self.now = now
        self.ledgerStore = ledgerStore
        self.owner = owner
        self.ledger = ledgerStore.load()
    }

    /// Argo spawned an agent, holds its PTY, and cannot say which Session it will turn out to be.
    /// It owns a PROCESS and never a Session: nothing observed will ever bind to this claim, which
    /// is the honest end of a CLI Argo cannot hand an id to.
    func claim() -> ClaimID {
        open(sessionID: nil, namedUUID: nil)
    }

    /// Argo spawned a fresh agent and told it which transcript to write, so this claim waits for
    /// exactly one file rather than for whatever appears (#742).
    func claim(naming uuid: String) -> ClaimID {
        open(sessionID: nil, namedUUID: uuid)
    }

    /// Argo started a CLI on an EXISTING chain, so the claim names its Session from birth (#10).
    ///
    /// The id is the one the ROSTER carries — never the chain id `--resume` takes (#731).
    func claim(resuming sessionID: String) -> ClaimID {
        open(sessionID: sessionID, namedUUID: nil)
    }

    /// The PTY exited: this claim is over. The ledger keeps the fact that Argo held it, which is
    /// what a later launch grades `orphaned` on.
    func release(_ id: ClaimID) {
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
    /// held it is gone, `external` for a Session no Argo ever owned.
    ///
    /// One question only: is this Session one a claim NAMES. A Session that answers no is external
    /// however close to a claim it ran, which is the whole of #742 — Argo shares its folders with
    /// agents nobody here started.
    func provenance(sessionID: String?) -> SessionProvenance {
        if let bound = sessionID.flatMap({ boundSessions[$0] }) {
            return claims[bound]?.toMs == nil ? .managed : .orphaned
        }
        // No claim in THIS process, so the ledger is the only witness left. `external` means never
        // Argo's, which would be a false claim about a Session it spawned before the last quit.
        guard let sessionID, hasEverOwned(sessionID: sessionID) else { return .external }
        return .orphaned
    }

    /// The claim that named this transcript and is still waiting for it, or nothing. One claim is
    /// one agent, so a claim that already HAS its Session names nothing further (#731).
    func claimNaming(uuid: String) -> ClaimID? {
        issuedOrder.first { id in
            guard let claim = claims[id] else { return false }
            return claim.namedUUID == uuid && claim.sessionID == nil
        }
    }

    private func open(sessionID: String?, namedUUID: String?) -> ClaimID {
        issued += 1
        let id = ClaimID(value: "claim-\(issued)")
        claims[id] = Claim(fromMs: now(), toMs: nil, sessionID: sessionID, namedUUID: namedUUID)
        issuedOrder.append(id)
        // Reachable under its own id from birth: the roster carries a row for this agent before its
        // transcript exists (#361), and that row's terminal is looked up the same way.
        boundSessions[id.value] = id
        guard let sessionID else { return id }
        boundSessions[sessionID] = id
        recordOwnership(of: sessionID)
        return id
    }
}

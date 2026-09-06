@testable import ArgoEngine
import Foundation
import Testing

/// How the ledger finds a Session whose transcript the CLI has moved (#770). A second suite beside
/// `SessionOwnershipLedgerTests` rather than more of it: that one is at the type body cap, and
/// these read the ledger as a value rather than through a registry.
///
/// The cost is the point. The roster asks this twice per Session per fold, inside
/// `ArgoApp.body.getter`, against a file that on a used machine holds a few hundred windows — so
/// the lookup has to answer without reading them (#1495).
@Suite("Session ownership ledger index")
@MainActor
struct SessionOwnershipLedgerIndexTests {
    /// The transcript a spawn is told to write, and the name the two paths below share.
    private let uuid = "11111111-2222-3333-4444-555555555555"

    private let owner = SessionOwnershipLedger.Owner(pid: 1, registry: "one-registry")

    @Test
    func `every window is in the index, so a moved transcript is one read away`() {
        var ledger = SessionOwnershipLedger()
        for entry in 0 ..< 400 {
            _ = ledger.open(
                sessionID: Self.path("other-\(entry)", UUID().uuidString), atMs: 1000, owner: owner,
            )
        }
        let before = Self.path("records", uuid)
        _ = ledger.open(sessionID: before, atMs: 2000, owner: owner)

        // The same file under the path the CLI moved it TO, which no window is keyed to.
        #expect(ledger.hasOwned(sessionID: Self.path("worktree", uuid)))
        // And that answer was one dictionary read: every window sits in the index under its own
        // uuid already, so finding this one split no path.
        #expect(ledger.keyByUUID.count == ledger.windows.count)
        #expect(ledger.keyByUUID[uuid] == before)
    }

    /// The index is derived, so it has to be there for a ledger that arrived as a file rather than
    /// through `open` — which is every ledger a relaunch reads.
    @Test
    func `a ledger read back from its file finds a moved transcript too`() throws {
        var ledger = SessionOwnershipLedger()
        _ = ledger.open(sessionID: Self.path("records", uuid), atMs: 1000, owner: owner)

        let read = try JSONDecoder()
            .decode(SessionOwnershipLedger.self, from: JSONEncoder().encode(ledger))

        #expect(read == ledger)
        #expect(read.hasOwned(sessionID: Self.path("worktree", uuid)))
    }

    /// Two windows carry one uuid where Argo held the Session both before and after the move. The
    /// later window is the answer, by a rule rather than by whichever the dictionary held first —
    /// two reads of one file must not disagree about which ticket a Session was started on.
    @Test
    func `the later window answers where two paths share a uuid`() {
        var ledger = SessionOwnershipLedger()
        let before = Self.path("records", uuid)
        let after = Self.path("worktree", uuid)
        _ = ledger.open(sessionID: before, atMs: 1000, owner: owner)
        _ = ledger.note(770, at: \.ticket, sessionID: before)
        _ = ledger.open(sessionID: after, atMs: 2000, owner: owner)
        _ = ledger.note(1495, at: \.ticket, sessionID: after)

        #expect(ledger.ticket(sessionID: Self.path("elsewhere", uuid)) == 1495)
    }

    /// A Session id with no uuid in it — the roster carries a claim's own id before the transcript
    /// exists (#361), and the index has to hold that key rather than drop it.
    @Test
    func `a Session id that is not a path is indexed under itself`() {
        var ledger = SessionOwnershipLedger()
        _ = ledger.open(sessionID: "claim-1", atMs: 1000, owner: owner)

        #expect(ledger.hasOwned(sessionID: "claim-1"))
        #expect(ledger.keyByUUID["claim-1"] == "claim-1")
    }

    private static func path(_ folder: String, _ uuid: String) -> String {
        "/records/\(folder)/\(uuid).jsonl"
    }
}

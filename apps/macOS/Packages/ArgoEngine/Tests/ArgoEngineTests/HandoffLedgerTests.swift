@testable import ArgoEngine
import Foundation
import Testing

/// The precedence between the live half and the written half, which lived in one merge expression
/// with no test naming it until #634.
@MainActor
struct HandoffLedgerTests {
    private func ledger(_ file: URL? = nil) -> HandoffLedger {
        HandoffLedger(store: HandoffChainStore(fileURL: file))
    }

    private func claimed(_ value: String) -> SessionOwnership.ClaimID {
        SessionOwnership.ClaimID(value: value)
    }

    @Test
    func `a Session that handed nothing over has no edge`() {
        #expect(ledger().edge(of: "session-1") == nil)
    }

    /// The fresh row is reachable under the CLAIM until its CLI writes a record, so that is what
    /// the edge answers — a link waiting for a name is still a link.
    @Test
    func `a handoff points at the claim until the fresh agent writes a record`() {
        let handoff = ledger()
        handoff.record(from: "session-1", claim: claimed("claim-7"), atMs: 100)
        #expect(handoff.edge(of: "session-1") == "claim-7")
    }

    @Test
    func `naming a claim leaves the edge pointing at the same row`() {
        let handoff = ledger()
        handoff.record(from: "session-1", claim: claimed("claim-7"), atMs: 100)
        handoff.name(claim: claimed("claim-7"), as: "session-2")
        #expect(handoff.edge(of: "session-1") == "claim-7")
    }

    /// A restart keeps the written half and loses the live one, so the edge comes back as the id
    /// the fresh CLI picked — which is the whole reason the chain is on disk.
    @Test
    func `a restart follows the link by the id the fresh agent picked`() throws {
        let file = try temporaryChainFile()
        defer { try? FileManager.default.removeItem(at: file) }
        let handoff = ledger(file)
        handoff.record(from: "session-1", claim: claimed("claim-7"), atMs: 100)
        handoff.name(claim: claimed("claim-7"), as: "session-2")

        #expect(ledger(file).edge(of: "session-1") == "session-2")
    }

    /// A handoff whose fresh agent never wrote a record is not followable after a restart: the
    /// claim it named belonged to the process that is gone.
    @Test
    func `a restart cannot follow a link that was never named`() throws {
        let file = try temporaryChainFile()
        defer { try? FileManager.default.removeItem(at: file) }
        let handoff = ledger(file)
        handoff.record(from: "session-1", claim: claimed("claim-7"), atMs: 100)

        #expect(ledger(file).edge(of: "session-1") == nil)
    }

    /// The precedence rule, stated: this process's own handoff is the same one on disk, held under
    /// the claim that is still the row's id until the rebind happens.
    @Test
    func `the live half wins over the written one while both name the same handoff`() throws {
        let file = try temporaryChainFile()
        defer { try? FileManager.default.removeItem(at: file) }
        let first = ledger(file)
        first.record(from: "session-1", claim: claimed("claim-7"), atMs: 100)
        first.name(claim: claimed("claim-7"), as: "session-2")

        // A second handoff off the SAME Session, made by this process and not yet named.
        first.record(from: "session-1", claim: claimed("claim-9"), atMs: 200)

        #expect(first.edge(of: "session-1") == "claim-9")
    }

    private func temporaryChainFile() throws -> URL {
        let token = String(UUID().uuidString.prefix(8))
        let root = URL(fileURLWithPath: NSTemporaryDirectory())
            .appending(path: "argo-chain-\(token)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        return root.appending(path: "chain.json")
    }
}

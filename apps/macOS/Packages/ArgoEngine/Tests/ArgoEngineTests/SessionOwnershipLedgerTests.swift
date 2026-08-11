@testable import ArgoEngine
import Foundation
import Testing

/// The half of ownership that has to survive the process (#10, ADR-0026): a second registry over
/// the same file is a relaunch, and it must be able to tell a Session Argo spawned from one it
/// never touched.
@Suite("Session ownership ledger")
@MainActor
struct SessionOwnershipLedgerTests {
    private let cwd = "/tmp/argo-owned"

    /// A registry over a file of this test's own — never the machine's. Its clock is held at 1000
    /// so a claim opens before the Sessions below are said to have started.
    private func registry(at fileURL: URL?) -> SessionOwnership {
        SessionOwnership(
            now: { 1000 },
            ledgerStore: SessionOwnershipLedgerStore(fileURL: fileURL),
        )
    }

    private func temporaryFileURL() -> URL {
        URL(fileURLWithPath: NSTemporaryDirectory())
            .appending(path: "argo-ledger-\(UUID().uuidString).json")
    }

    private func grading(_ ownership: SessionOwnership) -> SessionProvenance {
        ownership.provenance(sessionID: "session-a", cwd: cwd, startedAtMs: 2000)
    }

    @Test
    func `a Session a previous Argo owned reads orphaned rather than external`() {
        let fileURL = temporaryFileURL()
        defer { try? FileManager.default.removeItem(at: fileURL) }
        let first = registry(at: fileURL)
        let claim = first.claim(cwd: cwd)
        first.bind(sessionID: "session-a", cwd: cwd, startedAtMs: 2000)
        first.release(claim)

        // Nothing in memory carries over. `external` would claim the Session was never Argo's.
        #expect(grading(registry(at: fileURL)) == .orphaned)
    }

    @Test
    func `a Session no Argo ever owned is still external after a relaunch`() {
        let fileURL = temporaryFileURL()
        defer { try? FileManager.default.removeItem(at: fileURL) }
        let first = registry(at: fileURL)
        _ = first.claim(cwd: cwd)
        first.bind(sessionID: "somebody-elses", cwd: cwd, startedAtMs: 2000)

        #expect(grading(registry(at: fileURL)) == .external)
    }

    /// A claim opens the window at the moment it is made and the release closes it, so a file read
    /// back holding an OPEN window is an Argo that was killed rather than quit.
    @Test
    func `the window records both ends of one act of ownership`() {
        let fileURL = temporaryFileURL()
        defer { try? FileManager.default.removeItem(at: fileURL) }
        let clock = ClockStub()
        let ownership = SessionOwnership(
            now: { clock.nowMs },
            ledgerStore: SessionOwnershipLedgerStore(fileURL: fileURL),
        )

        let claim = ownership.claim(cwd: cwd, resuming: "session-a")
        clock.nowMs = 9000
        ownership.release(claim)

        let written = SessionOwnershipLedgerStore(fileURL: fileURL).load()
        #expect(written.windows["session-a"] == .init(fromMs: 1000, toMs: 9000))
    }

    /// A registry with no file is the render harness and every test that never named one: it must
    /// neither read nor write the machine's own ledger.
    @Test
    func `a registry with no file remembers nothing`() {
        let ownership = registry(at: nil)
        _ = ownership.claim(cwd: cwd)
        ownership.bind(sessionID: "session-a", cwd: cwd, startedAtMs: 2000)

        // Within the launch it still knows; the next one reads nothing at all.
        #expect(ownership.hasEverOwned(sessionID: "session-a"))
        #expect(grading(registry(at: nil)) == .external)
    }

    private final class ClockStub {
        var nowMs = 1000
    }
}

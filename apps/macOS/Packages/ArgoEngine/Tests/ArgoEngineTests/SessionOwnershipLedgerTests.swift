@testable import ArgoEngine
import Foundation
import Testing

/// The half of ownership that has to survive the process (#10, ADR-0026): a second registry over
/// the same file is a relaunch, and it must be able to tell a Session Argo spawned from one it
/// never touched.
@Suite("Session ownership ledger")
@MainActor
struct SessionOwnershipLedgerTests {
    /// The transcript a spawn is told to write, and the Session the roster keys to that file.
    private let uuid = "11111111-2222-3333-4444-555555555555"

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
        ownership.provenance(sessionID: "session-a")
    }

    @Test
    func `a Session a previous Argo owned reads orphaned rather than external`() {
        let fileURL = temporaryFileURL()
        defer { try? FileManager.default.removeItem(at: fileURL) }
        let first = registry(at: fileURL)
        let claim = first.claim(naming: uuid)
        first.bind(sessionID: "session-a", uuid: uuid)
        first.release(claim)

        // Nothing in memory carries over. `external` would claim the Session was never Argo's.
        #expect(grading(registry(at: fileURL)) == .orphaned)
    }

    @Test
    func `a Session no Argo ever owned is still external after a relaunch`() {
        let fileURL = temporaryFileURL()
        defer { try? FileManager.default.removeItem(at: fileURL) }
        let first = registry(at: fileURL)
        _ = first.claim(naming: uuid)
        first.bind(sessionID: "somebody-elses", uuid: "99999999-9999-9999-9999-999999999999")

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

        let claim = ownership.claim(resuming: "session-a")
        clock.nowMs = 9000
        ownership.release(claim)

        let written = SessionOwnershipLedgerStore(fileURL: fileURL).load()
        #expect(written.windows["session-a"]?.fromMs == 1000)
        #expect(written.windows["session-a"]?.toMs == 9000)
    }

    /// One Argo process runs many cockpit windows, so the pid alone cannot separate two owners —
    /// and a Session one window is steering must not be resumed by the next, or one chain gets two
    /// agents writing to it.
    @Test
    func `a Session another window of this Argo holds is not ours to resume`() {
        let fileURL = temporaryFileURL()
        defer { try? FileManager.default.removeItem(at: fileURL) }
        let other = registry(at: fileURL)
        _ = other.claim(resuming: "session-a")

        #expect(registry(at: fileURL).isHeldElsewhere(sessionID: "session-a"))
        // And the window that opened it is not held by somebody else.
        #expect(!other.isHeldElsewhere(sessionID: "session-a"))
    }

    /// The ordinary orphan: the window is open because that Argo was killed before it could close
    /// it, not because it is still there. Whether the pid is alive is what tells the two apart.
    @Test
    func `an open window whose Argo has died is held by nobody`() {
        let fileURL = temporaryFileURL()
        defer { try? FileManager.default.removeItem(at: fileURL) }
        let dead = SessionOwnership(
            now: { 1000 },
            ledgerStore: SessionOwnershipLedgerStore(fileURL: fileURL),
            // A pid no process can have, so `kill` answers `ESRCH` — as it would for any Argo that
            // has since exited.
            owner: .init(pid: .max, registry: "an-argo-that-is-gone"),
        )
        _ = dead.claim(resuming: "session-a")

        let relaunched = registry(at: fileURL)
        #expect(!relaunched.isHeldElsewhere(sessionID: "session-a"))
        #expect(grading(relaunched) == .orphaned)
    }

    /// A registry with no file is the render harness and every test that never named one: it must
    /// neither read nor write the machine's own ledger.
    @Test
    func `a registry with no file remembers nothing`() {
        let ownership = registry(at: nil)
        _ = ownership.claim(naming: uuid)
        ownership.bind(sessionID: "session-a", uuid: uuid)

        // Within the launch it still knows; the next one reads nothing at all.
        #expect(ownership.hasEverOwned(sessionID: "session-a"))
        #expect(grading(registry(at: nil)) == .external)
    }

    private final class ClockStub {
        var nowMs = 1000
    }
}

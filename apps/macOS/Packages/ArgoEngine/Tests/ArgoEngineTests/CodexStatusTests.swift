@testable import ArgoEngine
import Foundation
import Testing

/// What a Codex Session's status is read from (#683): `thread/status/changed`, and nothing else.
///
/// A Codex Session writes no transcript Argo reads, so this notification is the whole of the roster
/// reading. The arms and their flags are the server's own union, verified against codex-cli 0.147.0
/// and re-derivable with `codex app-server generate-json-schema`.
@Suite("Codex status")
@MainActor
struct CodexStatusTests {
    /// One arm of the server's union as it arrives on the wire, and the reading it establishes.
    struct Reported {
        let type: String
        let flags: [String]
        let status: SessionStatus
    }

    @Test(arguments: [
        Reported(type: "active", flags: [], status: .running),
        Reported(type: "active", flags: ["waitingOnApproval"], status: .permission),
        Reported(type: "active", flags: ["waitingOnUserInput"], status: .asking),
        Reported(type: "idle", flags: [], status: .idle),
        Reported(type: "systemError", flags: [], status: .unknown),
    ])
    func `the thread's own word for what it is doing is what the roster reads`(
        reported: Reported,
    ) {
        let peer = Self.opened()

        peer.server.statusChanged(reported.type, flags: reported.flags)

        #expect(peer.driveStatus == reported.status)
    }

    @Test
    func `a thread waiting on both an approval and a question reads as the approval`() {
        let peer = Self.opened()

        peer.server.statusChanged("active", flags: ["waitingOnUserInput", "waitingOnApproval"])

        #expect(peer.driveStatus == .permission)
    }

    @Test
    func `an active thread with a flag this vocabulary cannot read is still active`() {
        let peer = Self.opened()

        peer.server.statusChanged("active", flags: ["waitingOnSomethingNewer"])

        #expect(peer.driveStatus == .running)
    }

    /// Nothing claimed rather than something guessed: the handshake has not reached a thread, which
    /// says nothing about the Session yet, so the roster keeps its DERIVED reading.
    @Test
    func `a thread that is not loaded yet claims nothing`() {
        let peer = Self.opened()

        peer.server.statusChanged("notLoaded")

        #expect(peer.driveStatus == nil)
    }

    /// An arm this vocabulary cannot read leaves the LAST one Argo could read standing. Publishing
    /// nothing over it would drop a status the server has not retracted.
    @Test
    func `an arm this vocabulary cannot read leaves the last one alone`() {
        let peer = Self.opened()
        peer.server.statusChanged("idle")

        peer.server.statusChanged("hibernating")

        #expect(peer.driveStatus == .idle)
    }

    /// The process is gone, so the Turn it was running is over. A status left standing would go on
    /// reporting a Session as working with nothing behind it to work.
    @Test
    func `a thread whose server has gone stops reporting what it was doing`() {
        let peer = Self.opened()
        peer.server.statusChanged("active", flags: [])

        peer.thread.close()

        #expect(peer.driveStatus == nil)
    }

    private static func opened() -> CodexPeer {
        let peer = CodexPeer()
        peer.thread.begin()
        peer.server.open()
        return peer
    }
}

@testable import ArgoEngine
import Foundation

/// Where the client's lines land, and what its gate has published. A reference so the thread's
/// closures and the peer reading them are looking at one list rather than two copies.
@MainActor
final class CodexWire {
    var lines: [String] = []
    var readings = GateReadings()
}

/// One `CodexThread` with a stand-in server on the other end of it — the thread driven directly,
/// with no process, no Hub and no claim in the way.
@MainActor
final class CodexPeer {
    let thread: CodexThread
    let server: CodexConversation
    private let wire: CodexWire

    /// The patience is a parameter because the approvals need both ends of it: a day where Argo's
    /// clock must never be what decides, and no time at all for the tests about it running out.
    init(
        cwd: String = "/work",
        mode: SessionMode = .code,
        patience: PermissionPatience = .default,
    ) {
        let wire = CodexWire()
        let write: @MainActor (String) -> Bool = { line in
            wire.lines.append(line)
            return true
        }
        let approvals = CodexApprovals(
            patience: patience,
            publish: { wire.readings = $0 },
            write: { line in line.map { _ = write($0) } },
        )
        let thread = CodexThread(cwd: cwd, mode: mode, approvals: approvals, write: write)
        self.wire = wire
        self.thread = thread
        self.server = CodexConversation(
            written: { wire.lines },
            deliver: { thread.received(Array($0.utf8)) },
        )
    }

    /// What this Session's gate is showing — the readings the cockpit would draw off the claim.
    var readings: GateReadings {
        wire.readings
    }
}

@testable import ArgoEngine
import Foundation

/// Where the client's lines land. A reference so the thread's write closure and the peer reading it
/// are looking at one list rather than two copies.
@MainActor
final class CodexWire {
    var lines: [String] = []
}

/// One `CodexThread` with a stand-in server on the other end of it — the thread driven directly,
/// with no process, no Hub and no claim in the way.
@MainActor
final class CodexPeer {
    let thread: CodexThread
    let server: CodexConversation

    init(cwd: String = "/work", mode: SessionMode = .code) {
        let wire = CodexWire()
        let thread = CodexThread(cwd: cwd, mode: mode) { line in
            wire.lines.append(line)
            return true
        }
        self.thread = thread
        self.server = CodexConversation(
            written: { wire.lines },
            deliver: { thread.received(Array($0.utf8)) },
        )
    }
}

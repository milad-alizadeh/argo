@testable import ArgoEngine
import Foundation

/// One spawned Codex Session: the id the roster carries it under, and the server on the other end.
@MainActor
struct CodexSession {
    let id: String
    let server: CodexConversation
}

@MainActor
extension SpawnFixture {
    /// Spawn a Codex Session and walk its handshake, so what a test asserts on is the Turns rather
    /// than the three messages before them.
    func openCodexSession(seed: SessionSeed = .unseeded) async throws -> CodexSession {
        let claim = try await hub.spawnSession(cli: .codex, seed: seed)
        guard let process = host.started.last else {
            throw CodexFixtureFault.nothingStarted
        }
        let server = CodexConversation(
            written: { process.written },
            deliver: { process.emit($0) },
        )
        server.open()
        return CodexSession(id: claim.value, server: server)
    }
}

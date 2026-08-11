@testable import ArgoEngine
import Foundation
import Testing

/// The gate driven through the REAL hook script rather than a test client (#543). The relay's
/// `nc` half-closes the socket the moment its payload pipe ends, and a gate that reads that as
/// the hook dying refuses nothing and records nothing — the one failure only the shipped script
/// can show.
///
/// Nested inside `PermissionChannelTests` for `Expiry`'s reason: one serial scope over the
/// main-queue socket waits.
extension PermissionChannelTests {
    @Suite("Permission expiry through the real relay")
    @MainActor
    struct Relay {
        @Test
        func `a hook that outlives its payload is still told when the gate expires the call`()
            async throws {
            let patience = PermissionPatience(seconds: 2)
            try await PermissionGate.withGate(patience: patience) { fixture, claim, _ in
                let hook = try RelayHook.launched(fixture, claim)
                defer { hook.end() }

                // The payload's pipe is already closed, so any half-close has already happened:
                // the prompt must be raised AND survive it long enough for the clock to decide.
                await settle { fixture.hub.sessions.first?.permission != nil }
                await settle {
                    fixture.hub.sessions.first?.expiredPermissions.isEmpty == false
                }

                #expect(fixture.hub.sessions.first?.expiredPermissions.map(\.toolName)
                    == ["Bash"])
                await settle { !hook.process.isRunning }
                let told = hook.printed()
                #expect(told.contains("deny"), "\(told)")
                #expect(told.contains("expired"), "\(told)")
            }
        }

        @Test
        func `a hook killed with its turn takes the prompt away in silence`() async throws {
            try await PermissionGate.withGate { fixture, claim, _ in
                let hook = try RelayHook.launched(fixture, claim)
                defer { hook.end() }
                await settle { fixture.hub.sessions.first?.permission != nil }

                hook.process.terminate()
                await settle { fixture.hub.sessions.first?.permission == nil }

                #expect(fixture.hub.sessions.first?.permission == nil)
                #expect(fixture.hub.sessions.first?.expiredPermissions.isEmpty == true)
            }
        }
    }
}

/// The shipped `permission-hook.sh`, run the way the CLI runs it: payload on stdin, then the
/// pipe closed — the worst case for the relay, and the case the fifo holder exists for.
@MainActor
private final class RelayHook {
    let process = Process()
    private let stdout = Pipe()

    static func launched(
        _ fixture: SpawnFixture,
        _ claim: SessionOwnership.ClaimID,
    ) throws
        -> RelayHook {
        let hook = RelayHook()
        let script = fixture.companionRoot
            .appending(path: claim.value)
            .appending(path: "permission-hook.sh")
        hook.process.executableURL = URL(fileURLWithPath: "/bin/sh")
        hook.process.arguments = [script.path]
        let stdin = Pipe()
        hook.process.standardInput = stdin
        hook.process.standardOutput = hook.stdout
        try hook.process.run()
        stdin.fileHandleForWriting.write(Data((PermissionGate.bashCall + "\n").utf8))
        try stdin.fileHandleForWriting.close()
        return hook
    }

    /// Everything the hook said to its CLI. Read only once it has exited, so the read cannot
    /// block the main queue the gate's sockets live on.
    func printed() -> String {
        let data = stdout.fileHandleForReading.readDataToEndOfFile()
        return String(bytes: data, encoding: .utf8) ?? ""
    }

    func end() {
        if process.isRunning {
            process.terminate()
        }
    }
}

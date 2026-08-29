@testable import ArgoEngine
import Foundation

/// The shipped `permission-hook.sh`, run the way the CLI runs it: payload on stdin, then the
/// pipe closed — the worst case for the relay, and the case the fifo holder exists for.
@MainActor
final class RelayHook {
    let process = Process()
    private let stdout: OwnedPipe

    static func launched(
        _ fixture: SpawnFixture,
        _ claim: SessionOwnership.ClaimID,
    ) throws
        -> RelayHook {
        try launched(script: fixture.companionRoot
            .appending(path: claim.value)
            .appending(path: "permission-hook.sh"))
    }

    init() throws {
        self.stdout = try OwnedPipe()
    }

    static func launched(script: URL) throws -> RelayHook {
        let hook = try RelayHook()
        hook.process.executableURL = URL(fileURLWithPath: "/bin/sh")
        hook.process.arguments = [script.path]
        let stdin = try OwnedPipe()
        hook.process.standardInput = stdin.reading
        hook.process.standardOutput = hook.stdout.writing
        try hook.process.run()
        // Both ends the child inherited go now: the payload's is what makes the relay's worst case,
        // and the hook's stdout must reach EOF when the hook exits.
        stdin.release(stdin.reading)
        hook.stdout.release(hook.stdout.writing)
        stdin.writing.write(Data((PermissionGate.bashCall + "\n").utf8))
        return hook
    }

    /// Everything the hook said to its CLI. Read only once it has exited, so the read cannot
    /// block the main queue the gate's sockets live on.
    func printed() -> String {
        let data = (try? stdout.reading.readToEnd()) ?? Data()
        return String(bytes: data, encoding: .utf8) ?? ""
    }

    func end() {
        if process.isRunning {
            process.terminate()
        }
    }
}

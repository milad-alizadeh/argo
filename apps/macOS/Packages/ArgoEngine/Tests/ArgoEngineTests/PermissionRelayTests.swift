@testable import ArgoEngine
import Foundation
import Testing

/// The reason `permission-hook.sh` gives when it never reached the gate at all.
private let gateUnreachableReason = "Argo could not be reached to ask"

/// The gate driven through the REAL hook script rather than a test client (#543). The relay's
/// `nc` half-closes the socket the moment its payload pipe ends, and a gate that reads that as
/// the hook dying refuses nothing and records nothing — the one failure only the shipped script
/// can show.
///
/// Nested inside `PermissionChannelTests` for `Expiry`'s reason: one serial scope over the
/// main-queue socket waits.
extension PermissionChannelTests {
    @Suite("Permission gate through the real relay")
    @MainActor
    struct Relay {
        @Test
        func `a hook that outlives its payload is still told when the gate expires the call`()
            async throws {
            let clock = HeldPermissionClock()
            try await PermissionGate.withGate(patience: clock.patience) { fixture, claim, _ in
                let hook = try RelayHook.launched(fixture, claim)
                defer { hook.end() }

                // The payload's pipe is already closed, so any half-close has already happened:
                // the prompt must be raised AND survive it.
                try await hook.waitForPrompt(in: fixture)
                await anyHalfCloseHasLanded()
                #expect(fixture.hub.sessions.first?.permission != nil)

                clock.release()
                await settle {
                    fixture.hub.sessions.first?.expiredPermissions.isEmpty == false
                }

                #expect(fixture.hub.sessions.first?.expiredPermissions.map(\.toolName)
                    == ["Bash"])
                await settle { !hook.process.isRunning }
                let told = try hook.printed()
                #expect(told.contains("deny"), "\(told)")
                #expect(told.contains("expired"), "\(told)")
            }
        }

        @Test
        func `a hook killed with its turn takes the prompt away in silence`() async throws {
            try await PermissionGate.withGate { fixture, claim, _ in
                let hook = try RelayHook.launched(fixture, claim)
                defer { hook.end() }
                try await hook.waitForPrompt(in: fixture)

                hook.process.terminate()
                await settle { fixture.hub.sessions.first?.permission == nil }

                #expect(fixture.hub.sessions.first?.permission == nil)
                #expect(fixture.hub.sessions.first?.expiredPermissions.isEmpty == true)
            }
        }

        /// The only cover the script's fail-closed branch has, and the one place its reason is a
        /// passing answer.
        ///
        /// Removing the socket file reaches that branch by a different route than #936 did — a
        /// dial refused rather than a path with nothing on it — and `[ -z "$decision" ]` is where
        /// both arrive.
        @Test
        func `a hook that cannot reach the gate denies the call rather than letting it run`()
            async throws {
            try await PermissionGate.withGate { fixture, claim, _ in
                #expect(unlink(PermissionGate.path(fixture, claim)) == 0)
                let hook = try RelayHook.launched(fixture, claim)
                defer { hook.end() }

                await settle { !hook.process.isRunning }
                let told = try hook.printed(allowingUnreachableGate: true)
                // PARSED, not searched: a CLI that cannot read what a hook said reads it as a hook
                // with no opinion, and runs the call.
                let line = told.split(whereSeparator: \.isNewline).first.map(String.init) ?? ""
                let decision = try #require(JSONValue.record(fromLine: line)?["hookSpecificOutput"])
                #expect(decision.stringField("permissionDecision") == "deny")
                // Also what ties the constant above to the script's own wording: a reword fails
                // HERE rather than leaving the guard on the two tests above silently passing.
                #expect(decision.stringField("permissionDecisionReason") == gateUnreachableReason)
            }
        }
    }
}

/// How the relay suite fails when the hook is not in the conversation it was launched into.
private struct RelayHookFailure: Error, CustomStringConvertible {
    let description: String
}

/// Long enough that a half-close, which the socket carries within microseconds of the payload
/// beside it, has reached the gate as its own read event and been acted on.
///
/// NOTHING races this: the clock above is held, so the prompt cannot end while it runs. A machine
/// too slow for it makes the test slow rather than red, which is the direction #826 is about.
private func anyHalfCloseHasLanded() async {
    try? await Task.sleep(for: .milliseconds(250))
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

    /// Wait for the prompt, OR for this hook to give up before it. A hook that exits first was
    /// refused at the dial, so nothing waited for here can arrive any more — and the wait that
    /// only watched the prompt spent its whole hang guard before saying so (#936).
    func waitForPrompt(
        in fixture: SpawnFixture,
        at location: SourceLocation = #_sourceLocation,
    ) async throws {
        await settle(
            until: { fixture.hub.sessions.first?.permission != nil || !self.process.isRunning },
            message: "the gate never raised a prompt",
            at: location,
        )
        guard fixture.hub.sessions.first?.permission == nil, !process.isRunning else { return }
        let told = try printed()
        throw RelayHookFailure(
            description: "the hook exited before the gate raised a prompt: \(told)",
        )
    }

    /// Everything the hook said to its CLI, once it has exited.
    ///
    /// `allowingUnreachableGate` is for the one test that is ABOUT the fail-closed reason; anywhere
    /// else that reason means the gate was never reached, which is a different fact from whatever
    /// the test was asserting (#936).
    func printed(allowingUnreachableGate allowed: Bool = false) throws -> String {
        guard !process.isRunning else {
            throw RelayHookFailure(description: "the hook is still running, so it has said nothing")
        }
        let told = drained()
        guard allowed || !told.contains(gateUnreachableReason) else {
            throw RelayHookFailure(description: "the hook never reached the gate: \(told)")
        }
        return told
    }

    /// Whatever is in the pipe, without waiting for a writer to let go of it.
    ///
    /// `readDataToEndOfFile` waits for EVERY write end to close, and an `nc` orphaned by a killed
    /// shell holds one open against a gate that by design does not hang up (#543) — so the read
    /// this replaces could freeze the main actor rather than fail.
    private func drained() -> String {
        let descriptor = stdout.fileHandleForReading.fileDescriptor
        _ = fcntl(descriptor, F_SETFL, O_NONBLOCK)
        var told: [UInt8] = []
        var buffer = [UInt8](repeating: 0, count: 8192)
        while true {
            let count = read(descriptor, &buffer, buffer.count)
            guard count > 0 else { break }
            told += buffer[0 ..< count]
        }
        return String(bytes: told, encoding: .utf8) ?? ""
    }

    func end() {
        if process.isRunning {
            process.terminate()
        }
    }
}

@testable import ArgoEngine
import Foundation
import Testing

/// The reason `permission-hook.sh` gives when it never reached the gate at all.
let gateUnreachableReason = "Argo could not be reached to ask"

/// The reason it gives when the gate ANSWERED the dial and then never took the request (#1553) —
/// a socket reached, and a question no surface ever showed. Its own wording, because a gate that
/// cannot be dialled and a gate that says nothing are different facts about Argo.
let gateTookNothingReason = "Argo was reached but never took this request to ask"

/// How the relay suite fails when the hook is not in the conversation it was launched into.
struct RelayHookFailure: Error, CustomStringConvertible {
    let description: String
}

/// Long enough that a half-close, which the socket carries within microseconds of the payload
/// beside it, has reached the gate as its own read event and been acted on.
///
/// NOTHING races this: the clock above is held, so the prompt cannot end while it runs. A machine
/// too slow for it makes the test slow rather than red, which is the direction #826 is about.
func anyHalfCloseHasLanded() async {
    try? await Task.sleep(for: .milliseconds(250))
}

/// The shipped `permission-hook.sh`, run the way the CLI runs it: payload on stdin, then the
/// pipe closed — the worst case for the relay, and the case the fifo holder exists for.
@MainActor
final class RelayHook {
    let process = Process()
    private let stdout = Pipe()

    static func launched(
        _ fixture: SpawnFixture,
        _ claim: SessionOwnership.ClaimID,
    ) throws
        -> RelayHook {
        try launched(script: fixture.pluginRoot(claim).appending(path: "permission-hook.sh"))
    }

    /// The same launch against a hook written somewhere other than a spawn's own plugin — what a
    /// suite pointing the shipped script at a gate of its own making needs (#1553).
    static func launched(script: URL) throws -> RelayHook {
        let hook = RelayHook()
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

import ArgoEngine
@testable import ArgoTerminal
import Foundation
import Testing

/// The one thing no fake can prove: that Argo really does own a PTY, that what the child writes
/// comes back, and that ending it is reported.
///
/// Every child here writes and then SLEEPS rather than exiting on its own. SwiftTerm watches for
/// the exit with a `DispatchSource` process source, and a child that is already dead by the time
/// that source is armed may never deliver. What is asserted instead is `terminate()` ending it.
@Suite("SwiftTerm process host")
@MainActor
struct SwiftTermProcessHostTests {
    @Test(.timeLimit(.minutes(1)))
    func `a launched child's output comes back and terminating it is reported`() async throws {
        let host = SwiftTermProcessHost()
        var received: [UInt8] = []
        var hasExited = false

        // Held, not discarded: the handle owns the PTY, so dropping it ends the agent.
        let process = try host.start(
            Self.shell("echo argo-companion"),
            events: AgentProcessEvents(
                onData: { received += $0 },
                onExit: { _ in hasExited = true },
            ),
        )
        await Self.settle { Self.text(received).contains("argo-companion") }
        process.terminate()
        await Self.settle { hasExited }

        #expect(Self.text(received).contains("argo-companion"))
        #expect(hasExited)
    }

    @Test(.timeLimit(.minutes(1)))
    func `the launch runs in the folder it was given`() async throws {
        let host = SwiftTermProcessHost()
        let folder = URL(fileURLWithPath: NSTemporaryDirectory())
            .appending(
                path: "argo-host-\(UUID().uuidString.prefix(8))",
                directoryHint: .isDirectory,
            )
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        var received: [UInt8] = []

        let process = try host.start(
            Self.shell("pwd", cwd: folder.path),
            events: AgentProcessEvents(onData: { received += $0 }, onExit: { _ in }),
        )
        await Self.settle { Self.text(received).contains(folder.lastPathComponent) }
        process.terminate()

        #expect(Self.text(received).contains(folder.lastPathComponent))
    }

    @Test(.timeLimit(.minutes(1)))
    func `what the child is sent reaches it and comes back`() async throws {
        let host = SwiftTermProcessHost()
        var received: [UInt8] = []

        let process = try host.start(
            Self.shell("cat"),
            events: AgentProcessEvents(onData: { received += $0 }, onExit: { _ in }),
        )
        process.write("steered\n")
        await Self.settle { Self.text(received).contains("steered") }
        process.terminate()

        // A PTY echoes what is typed at it, so this is the whole steering loop.
        #expect(Self.text(received).contains("steered"))
    }

    /// A child that writes and then stays up, so the assertions above are not racing its exit.
    private static func shell(_ command: String, cwd: String = "/tmp") -> AgentLaunch {
        AgentLaunch(
            executablePath: "/bin/sh",
            cwd: cwd,
            arguments: ["-c", "\(command); sleep 30"],
        )
    }

    /// What the PTY carried, read as text. A terminal's bytes are not text in general, but the one
    /// thing these children write is.
    private static func text(_ bytes: [UInt8]) -> String {
        String(bytes: bytes, encoding: .utf8) ?? ""
    }

    /// Yield until a condition holds, up to a bound. The child is a real process, so its output
    /// arrives when the kernel says so and not on any turn this test controls.
    private static func settle(until condition: () -> Bool) async {
        let deadline = ContinuousClock.now + .seconds(20)
        while ContinuousClock.now < deadline, !condition() {
            await Task.yield()
        }
    }
}

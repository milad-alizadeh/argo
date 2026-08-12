@testable import ArgoEngine
import Foundation
import Synchronization
import Testing

/// Resolving a launch before anything is forked. The CLI missing from the user's `PATH` is the
/// commonest spawn failure there is, and turning it into a refusal here is what stops it being a
/// child that dies with nobody left to say why (#361).
@Suite("Agent launcher")
struct AgentLauncherTests {
    @Test
    func `a CLI the search path does not hold is refused by name`() async throws {
        let launcher = AgentLauncher(run: { _ in "/nowhere-at-all\n" })

        await #expect(throws: AgentSpawnError.executableNotFound(command: "claude")) {
            try await launcher.launch(cli: .claude, cwd: "/tmp", companion: nil)
        }
    }

    @Test
    func `the launch carries the login shell's PATH, not this process's`() async throws {
        let directory = try Self.directoryHolding("claude")
        defer { try? FileManager.default.removeItem(at: directory) }
        let launcher = AgentLauncher(run: { _ in "\(directory.path)\n" })

        let launch = try await launcher.launch(cli: .claude, cwd: "/tmp", companion: nil)

        #expect(launch.executablePath == directory.appending(path: "claude").path)
        // The agent inherits it too: an agent found through the shell's `PATH` still needs `git`
        // and `node` on the same one.
        #expect(launch.environment["PATH"] == directory.path)
        #expect(launch.environment["TERM"] == "xterm-256color")
    }

    @Test
    func `a companion invitation reaches the launch on argv and in the environment`() async throws {
        let directory = try Self.directoryHolding("claude")
        defer { try? FileManager.default.removeItem(at: directory) }
        let launcher = AgentLauncher(run: { _ in "\(directory.path)\n" })
        let invitation = CompanionInvitation(
            socketPath: "/tmp/argo.sock",
            pluginRoot: "/tmp/plugin",
            mcpConfigPath: "/tmp/plugin/.mcp.json",
        )

        let launch = try await launcher.launch(cli: .claude, cwd: "/tmp", companion: invitation)

        #expect(launch.arguments == ["--mcp-config", "/tmp/plugin/.mcp.json"])
        #expect(launch.environment["ARGO_COMPANION_SOCKET"] == "/tmp/argo.sock")
        #expect(launch.environment["CLAUDE_PLUGIN_ROOT"] == "/tmp/plugin")
    }

    /// Argo runs under `claude` as often as not, and a CLI that believes it is a child of another
    /// one writes no transcript of its own — so the Session Argo just spawned would be the one
    /// Session nothing could ever observe.
    @Test
    func `a spawned Session is never told it is another CLI's child`() async throws {
        let directory = try Self.directoryHolding("claude")
        defer { try? FileManager.default.removeItem(at: directory) }
        let launcher = AgentLauncher(
            run: { _ in "\(directory.path)\n" },
            inherited: ["CLAUDE_CODE_CHILD_SESSION": "1", "HOME": "/Users/somebody"],
        )

        let launch = try await launcher.launch(cli: .claude, cwd: "/tmp", companion: nil)

        #expect(launch.environment["CLAUDE_CODE_CHILD_SESSION"] == nil)
        // Scrubbed, not replaced: an agent needs the rest of the user's environment.
        #expect(launch.environment["HOME"] == "/Users/somebody")
    }

    /// Codex splits its billing on the credential rather than on the surface (ADR-0024), and an
    /// exported `OPENAI_API_KEY` is the one credential a spawn could be metered on. Argo must run
    /// on included tokens, so it hands Codex no key at all — which is a claim about what ARGO
    /// passes, and deliberately not one about which credential a given Codex would have preferred.
    @Test
    func `a spawned Codex is never handed an API key`() async throws {
        let directory = try Self.directoryHolding("codex")
        defer { try? FileManager.default.removeItem(at: directory) }
        let launcher = AgentLauncher(
            run: { _ in "\(directory.path)\n" },
            inherited: ["OPENAI_API_KEY": "sk-live", "HOME": "/Users/somebody"],
        )

        let launch = try await launcher.launch(cli: .codex, cwd: "/tmp", companion: nil)

        #expect(launch.environment["OPENAI_API_KEY"] == nil)
        #expect(launch.environment["HOME"] == "/Users/somebody")
    }

    /// The shell is asked ONCE. A `PATH` does not change while a window is open, and paying a
    /// login shell's startup per spawn would be felt.
    @Test
    func `the login shell is asked once, however many launches follow`() async throws {
        let directory = try Self.directoryHolding("claude")
        defer { try? FileManager.default.removeItem(at: directory) }
        // A `ShellCommand` is `@Sendable`, so what it counts has to be safe to touch from anywhere.
        let asked = Mutex(0)
        let launcher = AgentLauncher(run: { _ in
            asked.withLock { $0 += 1 }
            return "\(directory.path)\n"
        })

        _ = try await launcher.launch(cli: .claude, cwd: "/tmp", companion: nil)
        _ = try await launcher.launch(cli: .claude, cwd: "/tmp", companion: nil)

        #expect(asked.withLock { $0 } == 1)
    }

    private static func directoryHolding(_ command: String) throws -> URL {
        let directory = URL(fileURLWithPath: NSTemporaryDirectory())
            .appending(path: "argo-bin-\(UUID().uuidString.prefix(8))", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let url = directory.appending(path: command)
        try "#!/bin/sh\n".write(to: url, atomically: true, encoding: .utf8)
        try FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: url.path)
        return directory
    }
}

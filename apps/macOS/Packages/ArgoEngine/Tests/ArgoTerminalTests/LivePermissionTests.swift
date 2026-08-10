import ArgoEngine
import Foundation
import Testing

/// The permission gate against the CLI it exists for (#542). Excluded from the default run:
/// these spawn the real `claude`, spend real tokens, and take as long as an agent takes — set
/// `ARGO_LIVE_CLI=1` to run them.
///
/// What no other suite can show: that the hook Argo installs really does fire on a gated call,
/// that the CLI blocks on our socket, and that it acts on the word we send back.
@Suite("Live permission gate", .enabled(if: LiveCLI.isEnabled))
@MainActor
struct LivePermissionTests {
    @Test(.timeLimit(.minutes(10)))
    func `an allowed call runs, and the file it was asked for is there`() async throws {
        let live = try await LiveClaudeFixture.spawned()
        defer { live.end() }
        try live.ask(Self.prompt(touching: live.markerURL.path))

        let request = try #require(await live.pendingPermission(), "\(live.host.lastScreens)")
        #expect(request.toolName == "Bash")
        #expect(Self.command(of: request.target)?
            .contains(live.markerURL.lastPathComponent) == true)

        try live.hub.driver.decide(.allow, answering: request.id, for: live.claim.value)
        await live.settle(seconds: 120) { live.hasMarkerFile() }

        #expect(live.hasMarkerFile())
        #expect(live.hub.sessions.first?.permission == nil)
    }

    @Test(.timeLimit(.minutes(10)))
    func `a denied call does not run, and nothing is written`() async throws {
        let live = try await LiveClaudeFixture.spawned()
        defer { live.end() }
        try live.ask(Self.prompt(touching: live.markerURL.path))

        let request = try #require(await live.pendingPermission())
        try live.hub.driver.decide(.deny, answering: request.id, for: live.claim.value)
        // A denial is proven by an absence, so the wait IS the assertion: long enough that a call
        // the CLI had gone ahead with would have finished several times over.
        await live.settle(seconds: 30) { live.hasMarkerFile() }

        #expect(!live.hasMarkerFile())
        #expect(live.hub.sessions.first?.permission == nil)
    }

    /// One gated call and nothing else: the shorter the turn, the less of it is the agent's
    /// judgement and the more of it is the gate under test.
    private static func prompt(touching path: String) -> String {
        "Run this command with the Bash tool and do nothing else, "
            + "no reading and no explaining: touch \(path)"
    }

    private static func command(of target: PermissionRequest.Target) -> String? {
        switch target {
        case let .command(command): command
        case .edit, .raw: nil
        }
    }
}

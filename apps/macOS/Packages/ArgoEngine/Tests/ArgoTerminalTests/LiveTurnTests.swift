import ArgoEngine
import Foundation
import Testing

/// A Turn against the CLI that actually reads it (#682). Excluded from the default run: this
/// spawns the real `claude`, spends real tokens, and takes as long as an agent takes — set
/// `ARGO_LIVE_CLI=1` to run it.
///
/// What no other suite can show: that a real TUI takes the split Turn — two writes with a pause
/// between them — as one submitted message. It does NOT reproduce #682 on demand. That failure is
/// a race inside the CLI's own read, and it lands about one run in five in a working tree big
/// enough for the mention search to take a moment; this fixture's folder holds two files. The
/// deterministic claim is `ClaudeTurnTests`, which asserts the Return is a write of its own.
@Suite("Live turn", .enabled(if: LiveCLI.isEnabled))
@MainActor
struct LiveTurnTests {
    @Test(.timeLimit(.minutes(10)))
    func `a Turn naming a file with an at-token is really submitted`() async throws {
        let live = try await LiveClaudeFixture.spawned()
        defer { live.end() }
        // Written before the Turn goes, because the popup is opened by the token MATCHING
        // something: a mention of a file that is not there never opens one to eat the Return.
        try "The marker is the point of this run.\n"
            .write(to: live.root.appending(path: "notes.md"), atomically: true, encoding: .utf8)

        try live.ask(Self.prompt(touching: live.markerURL.path))

        // A Permission is the evidence: the CLI cannot ask about a call it was never told to make.
        let request = try #require(await live.pendingPermission(), "\(live.host.lastScreens)")
        #expect(request.toolName == "Bash")
    }

    /// The `@` token is the whole point, and it is mid-sentence rather than trailing — the state
    /// #682 was found in, where the popup opens and closes again as the rest of the paste arrives.
    private static func prompt(touching path: String) -> String {
        "Read @notes.md first, then run this command with the Bash tool and do nothing else: "
            + "touch \(path)"
    }
}

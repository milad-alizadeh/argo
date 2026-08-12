import ArgoEngine
import Foundation
import Testing

/// The command surface against the CLI it exists for (#685). Excluded from the default run for
/// `LivePermissionTests`' reason: these spawn the real `claude` and spend real tokens — set
/// `ARGO_LIVE_CLI=1` to run them.
///
/// What no other suite can show: that a `/command` inside Argo's bracketed-paste burst reaches the
/// CLI's own command handling instead of arriving as prose. `canRunCommands` is as true as this.
@Suite("Live command surface", .enabled(if: LiveCLI.isEnabled))
@MainActor
struct LiveCommandTests {
    /// The command carries no instruction — `/argo-live-probe` and nothing else. Only the skill's
    /// own body names the marker, so the file existing is the evidence the body arrived.
    ///
    /// On `Auto` because the command is under test and not the gate: a Permission mid-run would
    /// make a timing question out of a transport one.
    @Test(.timeLimit(.minutes(10)))
    func `a skill invoked by its own command runs the body the command never names`() async throws {
        let live = try await LiveClaudeFixture.spawned(on: .auto, carryingSkills: [.probe])
        defer { live.end() }

        try live.ask("/\(LiveSkill.probeName)")
        await live.settle(seconds: 300) { live.hasMarkerFile() }

        #expect(live.hasMarkerFile(), "\(live.host.lastScreens)")
    }
}

import ArgoEngine
import Foundation
import Testing

/// The ladder against the CLI it exists for (#629). Excluded from the default run for the reason
/// `LivePermissionTests` is: these spawn the real `claude`, spend real tokens, and take as long as
/// an agent takes — set `ARGO_LIVE_CLI=1` to run them.
///
/// What no other suite can show: that a rung Argo passes or walks to is a rung the CLI actually
/// stands on. Every assertion here is made against the CLI's own report or against the filesystem,
/// never against the argument Argo sent — an adapter that agrees with itself proves nothing.
@Suite("Live mode ladder", .enabled(if: LiveCLI.isEnabled))
@MainActor
struct LiveModeTests {
    /// The spawn half of the ladder: the flag went out on argv and the CLI wrote back the same
    /// rung. `Auto` because it is the rung the reported bug is about.
    @Test(.timeLimit(.minutes(10)))
    func `a Session spawned on a rung is reported standing on it`() async throws {
        let live = try await LiveClaudeFixture.spawned(on: .auto)
        defer { live.end() }

        // Nothing is written until the first prompt, so the Session is asked for the cheapest
        // Turn there is and the record follows it.
        try live.ask("Reply with the single word: ready")
        await live.settle(seconds: 180) { live.reportedRung != nil }

        #expect(live.reportedRung == "auto", "\(live.host.lastScreens)")
    }

    /// The reported bug, and the test that closes it: on `Auto` a gated call runs and nobody is
    /// asked. The file is the evidence the call ran; the watch is the evidence nothing asked.
    @Test(.timeLimit(.minutes(10)))
    func `Auto runs a gated call and never asks`() async throws {
        let live = try await LiveClaudeFixture.spawned(on: .auto)
        defer { live.end() }
        try live.ask(Self.prompt(touching: live.markerURL.path))

        let asked = await live.settleWatchingForPermissions(seconds: 180) { live.hasMarkerFile() }

        #expect(live.hasMarkerFile(), "\(live.host.lastScreens)")
        #expect(!asked, "\(live.host.lastScreens)")
    }

    /// The half of the ladder 2.1.228 took away, and what Argo does about it.
    ///
    /// `shift+tab` no longer moves a running Session, so the rung asked for here does not land
    /// (#653). What this proves is therefore the DEGRADE: the reading snaps back to the rung the
    /// CLI reports, and the composer is told which rung did not take — Argo never goes on drawing
    /// a rung it merely asked for.
    ///
    /// The change itself is a `withKnownIssue`, so the day the CLI accepts one again this test
    /// fails and says the known issue did not occur.
    @Test(.timeLimit(.minutes(15)))
    func `a rung that does not reach the CLI snaps back and says which one`() async throws {
        let live = try await LiveClaudeFixture.spawned()
        defer { live.end() }

        try live.ask(Self.prompt(touching: live.markerURL.path))
        let request = try #require(await live.pendingPermission(), "\(live.host.lastScreens)")
        try live.hub.driver.decide(.deny, answering: request.id, for: live.sessionID)

        // The rung is WALKED, not written, so a change passes through rungs nobody asked for and
        // the port refuses one mid-Turn (ADR-0025). Idle first, then the change.
        await live.settle(seconds: 120) { live.session?.status == .idle }
        try live.hub.driver.setMode(.auto, for: live.sessionID)
        try live.ask(Self.prompt(touching: live.followUpMarkerURL.path))

        // On `Auto` there would be nothing to answer. There is, and that IS the change not landing.
        let second = await live.pendingPermission()
        withKnownIssue("shift+tab no longer moves a running claude — #653") {
            #expect(second == nil)
        }
        let pending = try #require(second, "\(live.host.lastScreens)")
        try live.hub.driver.decide(.deny, answering: pending.id, for: live.sessionID)

        // The Turn has to END before the degrade is observable: `claude` writes its stance at Turn
        // boundaries, and until one is written AFTER the set, silence is not disagreement.
        await live.settle(seconds: 180) { live.session?.modeDidNotTake != nil }

        #expect(live.session?.modeDidNotTake == .auto, "\(live.host.lastScreens)")
        #expect(live.session?.mode == .exactly(.code, cli: "acceptEdits"))
        #expect(!live.hasFollowUpMarker())
    }

    /// The bottom of the ladder still stops the agent. Without this the suite above would pass just
    /// as well against a build that ignored the rung entirely and let everything through.
    @Test(.timeLimit(.minutes(10)))
    func `Read Only does not write the file`() async throws {
        let live = try await LiveClaudeFixture.spawned(on: .readOnly)
        defer { live.end() }
        try live.ask(Self.prompt(touching: live.markerURL.path))

        // A refusal is proven by an absence, so the wait IS the assertion: long enough that a call
        // the CLI had gone ahead with would have finished several times over.
        await live.settle(seconds: 120) { live.hasMarkerFile() }

        #expect(!live.hasMarkerFile(), "\(live.host.lastScreens)")
    }

    /// One gated call and nothing else, word for word `LivePermissionTests`': the shorter the turn,
    /// the less of it is the agent's judgement and the more of it is the rung under test.
    private static func prompt(touching path: String) -> String {
        "Run this command with the Bash tool and do nothing else, "
            + "no reading and no explaining: touch \(path)"
    }
}

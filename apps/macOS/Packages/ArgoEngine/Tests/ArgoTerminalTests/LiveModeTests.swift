import ArgoEngine
import Foundation
import Testing

/// The ladder against the CLI it exists for (#629, #653). Excluded from the default run for the
/// reason `LivePermissionTests` is: these spawn the real `claude`, spend real tokens, and take as
/// long as an agent takes — set `ARGO_LIVE_CLI=1` to run them.
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
    ///
    /// Both halves together, because either alone passes against a broken build: a gate that
    /// refused everything would raise no prompt, and one that asked at every rung would still let
    /// the file appear once somebody answered.
    @Test(.timeLimit(.minutes(10)))
    func `Auto runs a gated call and never asks`() async throws {
        let live = try await LiveClaudeFixture.spawned(on: .auto)
        defer { live.end() }
        try live.ask(Self.prompt(touching: live.markerURL.path))

        let asked = await live.settleWatchingForPermissions(seconds: 180) { live.hasMarkerFile() }

        #expect(live.hasMarkerFile(), "\(live.host.lastScreens)")
        #expect(!asked, "\(live.host.lastScreens)")
    }

    /// The other half of the ladder: a rung set on a Session that is ALREADY RUNNING reaches the
    /// live CLI (#653).
    ///
    /// Proven by behaviour and not by the record, which is the only proof worth having here: this
    /// Session raised a Permission on this exact call while it stood on `Code`, and raises none on
    /// the same call once it has been moved to `Auto`. The two halves are one claim — a build that
    /// simply stopped gating would fail the first, and one whose keystrokes went nowhere the
    /// second.
    ///
    /// It is also the regression test for the collapse. The walk from `acceptEdits` to `auto` is
    /// two back-tabs, and written as one string the CLI takes them as one and stops on `plan` — so
    /// the assertion has to name the rung the CLI landed on, not merely that it moved.
    ///
    /// The second Turn asks for no tool, and the claim is made off the CLI's own stance record.
    /// What a gated call does at `Auto` is the other test's evidence, and mixing the two would
    /// leave this one failing for either of two reasons.
    @Test(.timeLimit(.minutes(15)))
    func `a rung set on a running Session takes effect`() async throws {
        let live = try await LiveClaudeFixture.spawned()
        defer { live.end() }

        // A Permission raised is what makes this Session RUNNING rather than freshly spawned, and
        // it is the rung `Code` doing it — the state the change has to survive.
        try live.ask(Self.prompt(touching: live.markerURL.path))
        let request = try #require(await live.pendingPermission(), "\(live.host.lastScreens)")
        try live.hub.driver.decide(.deny, answering: request.id, for: live.sessionID)
        await live.settle(seconds: 120) { live.reportedRung != nil }
        #expect(live.reportedRung == "acceptEdits", "\(live.host.lastScreens)")

        // The rung is WALKED, not written, so a change passes through rungs nobody asked for and
        // the port refuses one mid-Turn (ADR-0025). Idle first, then the change.
        await live.settle(seconds: 120) { live.session?.status == .idle }
        try await live.hub.driver.setMode(.auto, for: live.sessionID)

        // `claude` writes its stance at Turn boundaries, so a Turn has to END before the CLI has
        // said anything at all about where the walk left it.
        try live.ask("Reply with the single word: ready")
        await live.settle(seconds: 180) { live.reportedRung == "auto" }

        #expect(live.reportedRung == "auto", "\(live.host.lastScreens)")
        #expect(live.session?.mode == .exactly(.auto, cli: "auto"))
        #expect(live.session?.modeDidNotTake == nil)
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

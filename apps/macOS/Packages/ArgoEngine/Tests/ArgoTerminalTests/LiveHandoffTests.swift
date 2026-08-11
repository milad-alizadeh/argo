@testable import ArgoEngine
import Foundation
import Testing

/// A handoff against the CLI it exists for (#628). Excluded from the default run for the reason
/// the permission suite is: a real `claude`, real tokens, and as long as an agent takes.
///
/// What no fake host can show: that the command Argo types is SUBMITTED. A double records the
/// string and asserts on its content, so a line feed where a carriage return belongs is invisible
/// to it. `notSteerable` and `noFolder` are decided before any CLI is involved and stay with the
/// fake.
///
/// Serialized: every wait here spins the main actor, and run side by side these starve the queue
/// the Hub reads its gate socket on.
@Suite("Live handoff", .enabled(if: LiveCLI.isEnabled), .serialized)
@MainActor
struct LiveHandoffTests {
    /// Longer than a handoff off a small Session takes, so the bound is never what ends the wait.
    private static let patience = HandoffPatience(pollMs: 500, limitMs: 30 * 60 * 1000)

    /// Story 47 against a real CLI, with the fresh Session proven to have READ what it was pointed
    /// at: the codename exists nowhere in its context except inside the brief.
    @Test(.timeLimit(.minutes(60)))
    func `a handoff hands the work over in a brief the fresh Session reads`() async throws {
        let codename = "ARGO-\(UUID().uuidString.prefix(6))"
        let live = try await LiveClaudeFixture.primed(
            saying: "Reply with just OK. The release codename is \(codename).",
            carryingSkills: ["handoff"],
        )
        defer { live.end() }

        let outcome = try await live.handoff(patience: Self.patience).run(
            SessionHandoff.Request(sessionID: live.sessionID, cwd: live.root.path, issue: 628),
        )

        let brief = try #require(live.hub.brief(at: outcome.briefPath), "\(live.host.lastScreens)")
        #expect(!brief.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

        // Its opening turn is let finish first, or the question joins that turn's keystrokes.
        await live.settleTurn(of: outcome.sessionID)
        let proof = live.root.appending(path: "codename-from-the-brief.txt")
        try await live.sendAndSettle(
            "Write the release codename named in your handoff brief into \(proof.path), "
                + "on one line and with nothing else in the file.",
            to: outcome.sessionID,
        )
        await live.settleAllowing(seconds: LiveClaudeFixture.turnSeconds) {
            FileManager.default.fileExists(atPath: proof.path)
        }

        let read = try #require(
            try? String(contentsOf: proof, encoding: .utf8),
            "\(live.host.lastScreens)",
        )
        #expect(read.contains(codename), "\(live.host.lastScreens)")
    }

    /// The edge is recorded against the claim the spawn published, then named with the id the CLI
    /// picks — so a roster that reloads after the fresh agent's first record still follows it.
    @Test(.timeLimit(.minutes(60)))
    func `the chain edge ends up naming the fresh Session by its CLI's own id`() async throws {
        let live = try await LiveClaudeFixture.primed(carryingSkills: ["handoff"])
        defer { live.end() }
        let source = live.sessionID

        let outcome = try await live.handoff(patience: Self.patience).run(
            SessionHandoff.Request(sessionID: source, cwd: live.root.path),
        )
        #expect(Self.handedOff(from: source, in: live) == outcome.sessionID)

        // Asserted only once the fresh agent has WRITTEN the record that gives its claim the CLI's
        // id. Waiting on the link itself would be waiting on the thing under test, and would pass
        // by timing out.
        await live.settleTurn(of: outcome.sessionID)
        await live.settleAllowing(seconds: 120) {
            Self.handedOff(from: source, in: live) != outcome.sessionID
        }

        let named = try #require(Self.handedOff(from: source, in: live), "\(live.host.lastScreens)")
        #expect(named != outcome.sessionID, "\(live.hub.sessions.map(\.id))")
        #expect(live.hub.sessions.contains { $0.id == named }, "\(live.hub.sessions.map(\.id))")
    }

    /// Two seconds, not twenty: a handoff off a one-Turn Session finished inside twenty when this
    /// was first run, and a bound the work can win is not a bound under test.
    @Test(.timeLimit(.minutes(30)))
    func `a brief that does not arrive ends the wait at its stated bound`() async throws {
        let live = try await LiveClaudeFixture.primed(carryingSkills: ["handoff"])
        defer { live.end() }

        await #expect(throws: SessionHandoff.Failure.briefNeverArrived(afterMs: 2000)) {
            try await live
                .handoff(patience: HandoffPatience(pollMs: 500, limitMs: 2000))
                .run(SessionHandoff.Request(sessionID: live.sessionID, cwd: live.root.path))
        }
    }

    /// A handoff Argo gave up on left `/handoff` running, and the Session has to survive that: the
    /// button is offered again on the same row, and a wedged Session would answer nothing.
    @Test(.timeLimit(.minutes(30)))
    func `a Session whose handoff timed out still takes the next Turn`() async throws {
        let live = try await LiveClaudeFixture.primed(carryingSkills: ["handoff"])
        defer { live.end() }
        _ = try? await live
            .handoff(patience: HandoffPatience(pollMs: 500, limitMs: 2000))
            .run(SessionHandoff.Request(sessionID: live.sessionID, cwd: live.root.path))

        // An interrupt first, because `/handoff` is still running and a prompt into a running turn
        // is a keystroke.
        try live.hub.driver.interrupt(live.sessionID)
        await live.settleAllowing(seconds: 120) { live.hub.sessions.first?.status == .idle }
        try await live.askAndSettle(
            "Run this command with the Bash tool and nothing else: touch \(live.markerURL.path)",
        )
        await live.settleAllowing(seconds: LiveClaudeFixture.turnSeconds) { live.hasMarkerFile() }

        #expect(live.hasMarkerFile(), "\(live.host.lastScreens)")
    }

    /// A file at the address with nothing in it is `/handoff` having started and not finished.
    /// Ending the wait on it seeds the fresh Session with an empty document — the one failure that
    /// would look like success.
    @Test(.timeLimit(.minutes(30)))
    func `a brief holding only whitespace does not end the wait`() async throws {
        let live = try await LiveClaudeFixture.primed()
        defer { live.end() }

        // The address is fixed so the file can be put there first, and the Hub reads it the way it
        // reads any brief. No skill is installed: what is under test is the rule about the bytes.
        let atMs = 1_700_000_000_000
        let brief = live.briefURL(forSessionID: live.sessionID, atMs: atMs)
        try FileManager.default.createDirectory(
            at: live.briefRoot,
            withIntermediateDirectories: true,
        )
        try "   \n\t\n".write(to: brief, atomically: true, encoding: .utf8)
        #expect(live.hub.brief(at: brief.path) == "   \n\t\n")

        await #expect(throws: SessionHandoff.Failure.briefNeverArrived(afterMs: 30 * 1000)) {
            try await live
                .handoff(
                    patience: HandoffPatience(pollMs: 500, limitMs: 30 * 1000),
                    namingTheBriefAtMs: atMs,
                )
                .run(SessionHandoff.Request(sessionID: live.sessionID, cwd: live.root.path))
        }
    }

    private static func handedOff(from sessionID: String, in live: LiveClaudeFixture) -> String? {
        live.hub.sessions.first { $0.id == sessionID }?.handedOffTo
    }
}

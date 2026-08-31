@testable import ArgoEngine
import Foundation
import Testing

/// Which rung a resumed Session comes back on (#966): the one its record last stated, else the one
/// its Start named, else the one the user last picked.
///
/// A relaunch and not a same-process orphan, because the claim's own rung dies with the process
/// that held it — the durable ledger is the only thing that crosses the gap (ADR-0026).
@Suite("Resume rung")
@MainActor
struct ResumeRungTests {
    private let sessionID = spawnedSessionID

    /// The friction #941 removed at the Start, staying removed one act later: the ticket build
    /// comes back on `Auto` rather than on whatever rung was last picked by hand.
    @Test
    func `a resumed ticket-started Session comes back on the rung its Start named`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let relaunched = try await Self.quit(fixture, having: SessionSeed(mode: .auto, ticket: 966))

        try await relaunched.resumeSession(sessionID: sessionID)

        #expect(fixture.launchedRung(1) == "auto")
    }

    /// And the user's own move down the ladder outranks it: a stance the record states is the
    /// Session's, and a resume matches it rather than dragging the Session back up to `Auto`.
    @Test
    func `a stated stance outranks the rung the Start named`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let relaunched = try await Self.quit(
            fixture,
            having: SessionSeed(mode: .auto, ticket: 966),
            stating: [.mode(cli: "plan")],
        )

        try await relaunched.resumeSession(sessionID: sessionID)

        #expect(fixture.launchedRung(1) == "plan")
    }

    /// A Session with no Start of its own to honour is exactly as it was: the store answers, which
    /// is the one defensible rung for it (#629).
    ///
    /// `Auto` rather than `Read Only`, because `ClaudePermissionMode` spells Read Only and Plan
    /// alike: a rung the CLI cannot tell from its neighbour cannot say WHICH answer the resume
    /// took. `auto` is also not the baseline the store falls back to, so the flag can only have
    /// come from the pick.
    @Test
    func `a resumed hand-started Session still opens on the rung last picked`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        _ = try await fixture.hub.spawnSession()
        await hubObserveToEnd(fixture.hub, spawnedSessionObservation(of: fixture))
        try await fixture.hub.driver.setMode(.auto, for: sessionID)
        let relaunched = try await Self.relaunch(fixture)

        try await relaunched.resumeSession(sessionID: sessionID)

        #expect(fixture.launchedRung(1) == "auto")
    }

    /// The rung a resume honours is Argo's answer for ONE Session, so it is not filed as the rung
    /// last picked — the next New Session still opens on the user's own pick (#629).
    @Test
    func `a resume is not the rung the next New Session opens on`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        fixture.hub.modeStore.remember(.readOnly)
        let relaunched = try await Self.quit(fixture, having: SessionSeed(mode: .auto, ticket: 966))
        try await relaunched.resumeSession(sessionID: sessionID)

        _ = try await relaunched.spawnSession()

        #expect(fixture.launchedRung(1) == "auto")
        #expect(fixture.launchedRung(2) == "plan")
    }

    /// One Argo starts a Session on the given seed, sees the record it wrote, and quits. What comes
    /// back shares the fixture's files and nothing else, which is what a relaunch is.
    private static func quit(
        _ fixture: SpawnFixture,
        having seed: SessionSeed,
        stating stance: [TranscriptEvent] = [],
    ) async throws
        -> Hub {
        _ = try await fixture.hub.spawnSession(seed: seed)
        await hubObserveToEnd(fixture.hub, record(of: fixture, stating: stance))
        return try await relaunch(fixture, stating: stance)
    }

    private static func relaunch(
        _ fixture: SpawnFixture,
        stating stance: [TranscriptEvent] = [],
    ) async throws
        -> Hub {
        fixture.hub.endOwnedSessions()
        let relaunched = fixture.restarted()
        await hubObserveToEnd(relaunched, record(of: fixture, stating: stance))
        #expect(relaunched.sessions.map(\.provenance) == [.orphaned])
        return relaunched
    }

    /// The record the spawned CLI wrote, with whatever stance the test says it stated.
    private static func record(
        of fixture: SpawnFixture,
        stating stance: [TranscriptEvent],
    )
        -> TranscriptObservation {
        hubTestObservation(
            at: spawnedTranscriptURL,
            events: [.cwd(fixture.projectURL.path)] + stance
                + [.prompt(text: "First prompt", images: [], atMs: 0), .turnEnded(.endTurn)],
        )
    }
}

import ArgoDesign
import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// What the running dot's pulse ages off (#1291). The rung `ArgoWaitAge` puts a wait on is the
/// loop's period, so a roster that handed the loop nothing would beat every dot at the freshest
/// rung however long its Turn had run — the reading this suite exists to refuse.
@Suite("Roster pulse age")
struct RosterPulseAgeTests {
    @Test
    func `a managed running row ages the pulse off its own Turn`() throws {
        let startedAtMs = Date().epochMs - 6 * 60 * 1000

        let row = try #require(SessionRosterProjection.rows(from: [
            Self.session(status: .running, access: .managed, startedAtMs: startedAtMs),
        ]).first)

        let started = try #require(row.turnStartedAt)
        #expect(abs(started.epochMs - startedAtMs) <= 1)
        // Six minutes is past the ladder's last threshold, so the dot beats at its floor.
        #expect(ArgoWaitAge.rung(at: -started.timeIntervalSinceNow) == ArgoWaitAge.coldest)
    }

    @Test
    func `an observed row hands the loop no start, because Argo never saw one`() throws {
        // Its slot reads `output … ago` — when a record last LANDED, which is not a Turn start.
        // Ageing a wait off it would be a DERIVED reading drawn as a DIRECT one.
        let row = try #require(SessionRosterProjection.rows(from: [
            Self.session(status: .running, access: .external, startedAtMs: Date().epochMs - 12000),
        ]).first)

        #expect(row.clock != nil)
        #expect(row.turnStartedAt == nil)
    }

    @Test(arguments: [SessionStatus.idle, .stopped, .ended])
    func `a row that is not running has no Turn to age`(status: SessionStatus) throws {
        let row = try #require(SessionRosterProjection.rows(from: [
            Self.session(status: status, access: .managed, startedAtMs: Date().epochMs - 60000),
        ]).first)

        #expect(row.turnStartedAt == nil)
    }

    private static func session(
        status: SessionStatus,
        access: CockpitPresentation.Session.Access,
        startedAtMs: Int,
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "session",
            title: "The roster row's pulse",
            access: access,
            status: status,
            chain: .init(
                program: .init(cli: .claude, model: "claude-opus-5"),
                span: .init(lastSeenAtMs: startedAtMs),
            ),
            work: .init(
                location: "/Users/milad/Developer/argo",
                workspace: .init(kind: .main, branch: "main"),
            ),
            transcript: .init(events: [.prompt(text: "go", images: [], atMs: startedAtMs)]),
        )
    }
}

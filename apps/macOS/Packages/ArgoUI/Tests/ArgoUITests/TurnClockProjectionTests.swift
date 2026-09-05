import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// The one age slot's three readings (`cockpit-roster-turn-clock.md`): a live Session duration for
/// a managed running Session, `output … ago` for an observed one, the seen phrase otherwise.
@Suite("Roster Turn clock projection")
struct TurnClockProjectionTests {
    private let now = Date(timeIntervalSince1970: 1_800_000_000)

    @Test
    func `a managed running Session's slot counts from its first prompt`() throws {
        let row = try #require(rows(session(
            status: .running,
            events: [.prompt(text: "go", images: [], atMs: msAgo(252))],
        )).first)

        #expect(row.clock == .turn(startedAtMs: msAgo(252)))
    }

    @Test
    func `a steer typed mid-turn does not restart the clock`() throws {
        // A steer is a prompt into the same sequence (`TranscriptEvent.prompt`), so the Session's
        // start is its FIRST prompt, never the latest one.
        let row = try #require(rows(session(
            status: .running,
            events: [
                .prompt(text: "go", images: [], atMs: msAgo(300)),
                .prompt(text: "also check the tests", images: [], atMs: msAgo(30)),
            ],
        )).first)

        #expect(row.clock == .turn(startedAtMs: msAgo(300)))
    }

    @Test
    func `a Turn boundary crossed mid-session does not restart the clock`() throws {
        // Unbroken by Turn boundaries (#1330): the total still counts from the Session's very
        // first prompt, the gap folded into it the same as the work either side.
        let row = try #require(rows(session(
            status: .running,
            lastSeenAtMs: msAgo(120),
            events: [
                .prompt(text: "go", images: [], atMs: msAgo(600)),
                .turnEnded(.endTurn),
                .prompt(text: "again", images: [], atMs: msAgo(45)),
            ],
        )).first)

        #expect(row.clock == .turn(startedAtMs: msAgo(600)))
    }

    @Test
    func `a Session whose first prompt carries no stamp degrades to the seen reading`() throws {
        // Degrade-down: a duration Argo cannot anchor is never guessed at.
        let row = try #require(rows(session(
            status: .running,
            lastSeenAtMs: msAgo(120),
            events: [.prompt(text: "go", images: [], atMs: nil)],
        )).first)

        #expect(row.clock == .seen("2m ago"))
    }

    @Test
    func `an observed mid-turn Session reads output-ago, never a duration`() throws {
        let row = try #require(rows(session(
            access: .external,
            status: .running,
            lastSeenAtMs: msAgo(12),
            // Even a stamped prompt is not Argo's Session start: the file was only ever observed.
            events: [.prompt(text: "go", images: [], atMs: msAgo(252))],
        )).first)

        #expect(row.clock == .output(sinceMs: msAgo(12)))
    }

    @Test
    func `an observed mid-turn Session with no record time claims nothing`() throws {
        let row = try #require(rows(session(
            access: .external,
            status: .running,
        )).first)

        #expect(row.clock == nil)
    }

    @Test
    func `every Session that is not running keeps the seen reading`() throws {
        let row = try #require(rows(session(
            status: .idle,
            lastSeenAtMs: msAgo(120),
            events: [.prompt(text: "go", images: [], atMs: msAgo(600)), .turnEnded(.endTurn)],
        )).first)

        #expect(row.clock == .seen("2m ago"))
    }

    @Test
    func `the live reading is announced as a duration owned`() throws {
        let row = try #require(rows(session(
            status: .running,
            events: [.prompt(text: "go", images: [], atMs: msAgo(252))],
        )).first)

        #expect(row.announcement.contains("running for 4 minutes 12 seconds"))
    }

    @Test
    func `the observed reading is announced as a point in time seen`() throws {
        let row = try #require(rows(session(
            access: .external,
            status: .running,
            lastSeenAtMs: msAgo(12),
        )).first)

        #expect(row.announcement.contains("last output 12 seconds ago"))
    }

    @Test(arguments: [
        (0, "0s"),
        (42, "42s"),
        (59, "59s"),
        (60, "1m 00s"),
        (252, "4m 12s"),
        (3599, "59m 59s"),
        (3600, "1h 00m"),
        (3840, "1h 04m"),
        (7440, "2h 04m"),
    ])
    func `a duration is figured to the second under an hour, to the minute past one`(
        seconds: Int, figure: String,
    ) {
        #expect(TurnClockPhrase.figure(seconds: seconds) == figure)
    }

    @Test
    func `a clock ahead of the record reads as no time at all`() {
        // The same floor AgePhrase keeps: skew is not a Session running in the future.
        #expect(TurnClockPhrase.figure(seconds: -30) == "0s")
        #expect(TurnClockPhrase.spoken(seconds: -30) == "0 seconds")
    }

    @Test(arguments: [
        (1, "1 second"),
        (42, "42 seconds"),
        (60, "1 minute"),
        (61, "1 minute 1 second"),
        (252, "4 minutes 12 seconds"),
        (3600, "1 hour"),
        (3840, "1 hour 4 minutes"),
    ])
    func `the spoken duration says its units in words`(seconds: Int, spoken: String) {
        #expect(TurnClockPhrase.spoken(seconds: seconds) == spoken)
    }

    func session(
        access: CockpitPresentation.Session.Access = .managed,
        status: SessionStatus,
        lastSeenAtMs: Int? = nil,
        events: [TranscriptEvent] = [],
    )
        -> CockpitPresentation.Session {
        RosterSessionFixture.session(
            id: "clocked",
            access: access,
            status: status,
            lastSeenAtMs: lastSeenAtMs,
            events: events,
        )
    }

    func rows(_ session: CockpitPresentation.Session) -> [SessionRosterProjection.Row] {
        SessionRosterProjection.rows(from: [session], now: now)
    }

    func msAgo(_ seconds: Int) -> Int {
        now.epochMs - seconds * 1000
    }
}

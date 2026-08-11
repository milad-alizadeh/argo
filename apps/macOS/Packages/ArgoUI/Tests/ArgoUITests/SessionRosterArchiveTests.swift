import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// What archiving does to the roster, as the projection publishes it.
@Suite("Session roster archive")
struct SessionRosterArchiveTests {
    /// A fixed clock, for the reason the sibling suite has one: an age is arithmetic against one,
    /// and a projection read against `Date()` asserts whatever the test machine's second was.
    private let now = Date(timeIntervalSince1970: 1_800_000_000)

    @Test
    func `an archived Session is absent from the roster`() {
        let sessions = [
            RosterSessionFixture.session(id: "kept"),
            RosterSessionFixture.session(id: "cleared", isArchived: true),
        ]

        let rows = SessionRosterProjection.rows(from: sessions, now: now)

        // Gone from the list, not drawn quieter in it.
        #expect(rows.map(\.id) == ["kept"])
    }

    @Test
    func `new activity in an archived Session does not put it back on the roster`() {
        // The stray tail story 16 is about: the Session that moved most recently on this roster
        // is the archived one, and the roster is ordered on exactly that key.
        let sessions = [
            RosterSessionFixture.session(id: "kept", lastSeenAtMs: msAgo(3600)),
            RosterSessionFixture.session(
                id: "cleared", status: .running, lastSeenAtMs: msAgo(0), isArchived: true,
            ),
        ]

        let rows = SessionRosterProjection.rows(from: sessions, now: now)

        // Only a decision puts a row back, and observing something is not one.
        #expect(rows.map(\.id) == ["kept"])
    }

    @Test
    func `the archived Sessions are the ones the roster left out`() {
        let sessions = [
            RosterSessionFixture.session(id: "kept"),
            RosterSessionFixture.session(id: "cleared", isArchived: true),
        ]

        let archived = SessionRosterProjection.archivedRows(from: sessions, now: now)

        // The two lists partition the Sessions: nothing is in both, and nothing is in neither.
        #expect(archived.map(\.id) == ["cleared"])
        #expect(archived.map(\.isArchived) == [true])
        #expect(SessionRosterProjection.rows(from: sessions, now: now).map(\.isArchived) == [false])
    }

    @Test
    func `an archived Session is described exactly as a kept one is`() throws {
        let branch = "argo/#514-archive-session-swipe"
        let cleared = RosterSessionFixture.session(
            id: "cleared", branch: branch, lastSeenAtMs: msAgo(120),
        )

        let row = try #require(SessionRosterProjection.archivedRows(
            from: [RosterSessionFixture.session(
                id: "cleared",
                branch: branch,
                lastSeenAtMs: msAgo(120),
                isArchived: true,
            )],
            now: now,
        ).first)

        // The foot draws the same row the roster would have.
        let kept = try #require(SessionRosterProjection.rows(from: [cleared], now: now).first)
        #expect(row.title == kept.title)
        #expect(row.branch == kept.branch)
        #expect(row.age == kept.age)
        #expect(row.announcement == kept.announcement)
    }

    /// The heard reading is not the read one: a screen reader would say the label's own "(2)" as
    /// punctuation, so the count is spelled out in words.
    @Test(arguments: [
        (count: 1, label: "Archived (1)", announcement: "Archived, 1 Session"),
        (count: 2, label: "Archived (2)", announcement: "Archived, 2 Sessions"),
    ])
    func `the foot names how many Sessions are behind it`(
        count: Int, label: String, announcement: String,
    ) throws {
        let sessions = (0 ..< count).map {
            RosterSessionFixture.session(id: "archived-\($0)", isArchived: true)
        }

        let foot = try #require(SessionRosterProjection.archivedFoot(
            SessionRosterProjection.archivedRows(from: sessions, now: now),
        ))

        #expect(foot.label == label)
        #expect(foot.announcement == announcement)
    }

    @Test
    func `there is no foot at all when nothing has been archived`() {
        // A machine that has archived nothing pays no permanent chrome for the fact.
        #expect(SessionRosterProjection.archivedFoot([]) == nil)
    }

    @Test
    func `the archived roster the specimen renders shows a count and a live cleared Session`() {
        // The `archivedRoster` PNG is the only evidence the foot has: one archived Session would
        // leave the plural unrendered, and an all-finished set would agree with the wrong rule.
        let archived = ArchivedRosterSpecimen.archived

        #expect(archived.count > 1)
        #expect(archived.contains { $0.state == .running })
        #expect(ArchivedRosterSpecimen.rows.isEmpty == false)
        #expect(Set(ArchivedRosterSpecimen.rows.map(\.id))
            .isDisjoint(with: archived.map(\.id)))
    }

    private func msAgo(_ seconds: Int) -> Int {
        now.epochMs - seconds * 1000
    }
}

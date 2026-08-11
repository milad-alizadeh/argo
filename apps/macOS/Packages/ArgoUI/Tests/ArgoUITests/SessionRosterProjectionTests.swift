import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

@Suite("Session roster projection")
struct SessionRosterProjectionTests {
    /// A fixed clock, because an age is arithmetic against one: a projection read against
    /// `Date()` asserts whatever the test machine's second happened to be.
    private let now = Date(timeIntervalSince1970: 1_800_000_000)

    @Test
    func `input order survives operational state changes`() {
        let sessions = [
            RosterSessionFixture.session(id: "older", status: .idle),
            RosterSessionFixture.session(id: "attention", status: .asking),
            RosterSessionFixture.session(id: "newer", status: .running),
        ]

        let rows = SessionRosterProjection.rows(from: sessions)

        #expect(rows.map(\.id) == ["older", "attention", "newer"])
        #expect(rows.map(\.state) == [.idle, .attention, .running])
    }

    @Test
    func `every Session status spends the one word it has earned`() {
        // `Stopped` means the Turn ended short, not that anything crashed; `ended` is a
        // cancelled or exited Session and reads idle.
        let expected: [(status: SessionStatus, word: String?)] = [
            (.running, nil),
            (.permission, "Needs input"),
            (.asking, "Needs input"),
            (.idle, nil),
            (.stopped, "Stopped"),
            (.ended, nil),
            (.unknown, nil),
        ]

        // Every status is answered here, so one added to the domain fails rather than quietly
        // inheriting its colour role's word.
        #expect(expected.map(\.status) == SessionStatus.allCases)
        #expect(rows(of: expected.map(\.status)).map(\.stateWord) == expected.map(\.word))
    }

    @Test
    func `the announced word is the drawn word, never a second claim beside it`() throws {
        let row = try #require(rows(RosterSessionFixture.session(id: "stopped", status: .stopped))
            .first)

        #expect(row.stateWord == "Stopped")
        #expect(row.announcement.contains("Stopped"))
    }

    @Test
    func `a Session with no word announces the rest of the row without it`() throws {
        let row = try #require(
            rows(RosterSessionFixture.session(
                id: "quiet",
                workspaceLocation: "\(RosterSessionFixture.checkout)/.claude/worktrees/tkt-537",
                kind: .worktree,
                status: .idle,
                lastSeenAtMs: msAgo(120),
            )).first,
        )

        // No empty slot where the word would have been.
        #expect(row.announcement == "Session quiet, in tkt-537, last active 2m ago")
    }

    @Test
    func `every Session status has one colour role, and unknown has none`() {
        // `allCases`, so a status added to the domain fails here rather than taking whichever
        // colour the mapping's last branch happens to be.
        #expect(rows(of: SessionStatus.allCases).map(\.state) == [
            .running, .attention, .attention, .idle, .failure, .idle, nil,
        ])
    }

    @Test
    func `access is a fact about the whole row, not one the roster spends by comparison`() {
        let mixed = SessionRosterProjection.rows(
            from: [
                RosterSessionFixture.session(id: "managed", access: .managed),
                RosterSessionFixture.session(id: "external", access: .external),
            ],
        )
        let uniform = SessionRosterProjection.rows(
            from: [
                RosterSessionFixture.session(id: "one", access: .external),
                RosterSessionFixture.session(id: "two", access: .external),
            ],
        )

        #expect(mixed.map(\.isReadOnly) == [false, true])
        // A roster where every Session is read-only says so on every row.
        #expect(uniform.map(\.isReadOnly) == [true, true])
    }

    @Test
    func `a read-only Session announces itself, with no glyph left to carry the fact`() throws {
        let row = try #require(rows(RosterSessionFixture.session(id: "external", access: .external))
            .first)

        // The row draws this by ghosting, which a screen reader cannot hear. The label is
        // where the fact survives the ink.
        #expect(row.isReadOnly)
        #expect(row.announcement.contains("Read-only Session"))
    }

    @Test
    func `read-only Sessions carry no invented operational word`() throws {
        let row = try #require(SessionRosterProjection.rows(
            from: [
                RosterSessionFixture.session(id: "external", access: .external, status: .unknown),
            ],
        ).first)

        #expect(row.stateWord == nil)
        #expect(row.state == nil)
    }

    @Test
    func `an idle Session says how long ago it last moved`() throws {
        let row = try #require(rows(RosterSessionFixture.session(
            id: "idle",
            lastSeenAtMs: msAgo(120),
        )).first)

        // `ago` and not a bare `2m`, which would read as how long something took.
        #expect(row.age == "2m ago")
    }

    @Test(arguments: [
        (0, "just now"),
        (1, "just now"),
        (59, "just now"),
        (60, "1m ago"),
        (3599, "59m ago"),
        (3600, "1h ago"),
        (86399, "23h ago"),
        (86400, "1d ago"),
    ])
    func `an age is worded in the largest unit that has fully passed`(
        secondsAgo: Int, phrase: String,
    ) throws {
        let row = try #require(rows(RosterSessionFixture.session(
            id: "idle",
            lastSeenAtMs: msAgo(secondsAgo),
        ))
        .first)

        #expect(row.age == phrase)
    }

    @Test
    func `a clock behind the record it is measuring against reads as no time at all`() throws {
        // Two machines' clocks, or one that moved: the record is allowed to be newer than the
        // read of the moment. `in 3m` would be the roster claiming the future.
        let row = try #require(rows(RosterSessionFixture.session(
            id: "skewed",
            lastSeenAtMs: msAgo(-180),
        )).first)

        #expect(row.age == "just now")
    }

    @Test
    func `a running Session words its age like any other`() throws {
        let row = try #require(
            rows(RosterSessionFixture.session(
                id: "running",
                status: .running,
                lastSeenAtMs: msAgo(120),
            )).first,
        )

        // The status decides the dot, never whether the age line is there.
        #expect(row.age == "2m ago")
    }

    @Test
    func `a Session whose record carries no activity time shows no age`() throws {
        let row = try #require(rows(RosterSessionFixture.session(id: "timeless", lastSeenAtMs: nil))
            .first)

        // Absence renders as absence.
        #expect(row.age == nil)
    }

    @Test
    func `an explicit name beats the derived title`() throws {
        let row = try #require(rows(RosterSessionFixture.session(
            id: "named",
            explicitName: "The overnight run",
        )).first)

        // The name you set is the name you see (#502, story 19).
        #expect(row.title == "The overnight run")
        #expect(row.announcement.hasPrefix("The overnight run"))
    }

    private func rows(_ session: CockpitPresentation.Session) -> [SessionRosterProjection.Row] {
        SessionRosterProjection.rows(from: [session], now: now)
    }

    /// One row per status, in the order given.
    private func rows(of statuses: [SessionStatus]) -> [SessionRosterProjection.Row] {
        SessionRosterProjection.rows(
            from: statuses.enumerated()
                .map { RosterSessionFixture.session(id: "\($0.offset)", status: $0.element) },
            now: now,
        )
    }

    private func msAgo(_ seconds: Int) -> Int {
        now.epochMs - seconds * 1000
    }
}

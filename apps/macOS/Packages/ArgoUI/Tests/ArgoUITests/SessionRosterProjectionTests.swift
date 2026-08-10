import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

@Suite("Session roster projection")
struct SessionRosterProjectionTests {
    /// A fixed clock, because an age is arithmetic against one: a projection read against
    /// `Date()` asserts whatever the test machine's second happened to be.
    private let now = Date(timeIntervalSince1970: 1_800_000_000)
    private let main = RosterSessionFixture.mainCheckout

    @Test
    func `input order survives operational state changes`() {
        let sessions = [
            RosterSessionFixture.session(id: "older", status: .idle),
            RosterSessionFixture.session(id: "attention", status: .asking),
            RosterSessionFixture.session(id: "newer", status: .running),
        ]

        let rows = SessionRosterProjection.rows(from: sessions, mainCheckout: main)

        #expect(rows.map(\.id) == ["older", "attention", "newer"])
        #expect(rows.map(\.state) == [.idle, .attention, .running])
    }

    @Test
    func `every Session status spends the one word it has earned`() {
        // `Needs input` says what the Session is waiting for rather than who it wants.
        // `Stopped` says the Turn ended short — which is what the status means, not that
        // anything crashed; `ended` is a cancelled or exited Session and reads idle.
        let expected: [(status: SessionStatus, word: String?)] = [
            (.running, nil),
            (.permission, "Needs input"),
            (.asking, "Needs input"),
            (.idle, nil),
            (.stopped, "Stopped"),
            (.ended, nil),
            (.unknown, nil),
        ]

        // Every status is answered here, in the order the rows come back in, so a status
        // added to the domain fails rather than quietly inheriting its colour role's word.
        #expect(expected.map(\.status) == SessionStatus.allCases)
        #expect(rows(of: expected.map(\.status)).map(\.stateWord) == expected.map(\.word))
    }

    @Test
    func `the announced word is the drawn word, never a second claim beside it`() throws {
        // The word is one decision made once: a label that said `Failed` while the row read
        // `Stopped` would be the roster telling a screen reader something else.
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
                workspaceLocation: "\(main)/.claude/worktrees/tkt-537",
                status: .idle,
                lastSeenAtMs: msAgo(120),
            )).first,
        )

        // No empty slot where the word would have been, and the read-only fact — which the
        // lock is allowed to suppress visually — is never suppressed here.
        #expect(row.announcement == "Session quiet, in tkt-537, last active 2m ago")
    }

    @Test
    func `every Session status has one colour role, and unknown has none`() {
        // `allCases`, so a status added to the domain fails here rather than quietly taking
        // whichever colour the mapping's last branch happens to be.
        // A dot is a claim about what the Session is doing; `unknown` makes none.
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
            mainCheckout: main,
        )
        let uniform = SessionRosterProjection.rows(
            from: [
                RosterSessionFixture.session(id: "one", access: .external),
                RosterSessionFixture.session(id: "two", access: .external),
            ],
            mainCheckout: main,
        )

        #expect(mixed.map(\.isReadOnly) == [false, true])
        // A roster where every Session is read-only says so on every row. The glyph this
        // replaced was suppressed here, because a badge repeated down a list distinguishes
        // nothing — a row drawn quieter than its neighbours carries no such cost, and there
        // are no neighbours to compare against on a roster of one.
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
            mainCheckout: main,
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

        // `ago` and not a bare `2m`, which reads as how long something took rather than as
        // how long since it happened.
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
    func `a running Session shows no age`() throws {
        let row = try #require(
            rows(RosterSessionFixture.session(
                id: "running",
                status: .running,
                lastSeenAtMs: msAgo(120),
            )).first,
        )

        // The dot already says it is live, and the same `0m ago` repeated down the roster is
        // noise. Suppressed by the status, not by an absent time — this Session has one.
        #expect(row.age == nil)
    }

    @Test
    func `a Session whose record carries no activity time shows no age`() throws {
        let row = try #require(rows(RosterSessionFixture.session(id: "timeless", lastSeenAtMs: nil))
            .first)

        // Absence renders as absence. A placeholder would read as a moment nobody observed.
        #expect(row.age == nil)
    }

    private func rows(_ session: CockpitPresentation.Session) -> [SessionRosterProjection.Row] {
        SessionRosterProjection.rows(from: [session], mainCheckout: main, now: now)
    }

    /// One row per status, in the order given, so a per-status mapping is asserted against
    /// the statuses it was written for rather than against seven anonymous slots.
    private func rows(of statuses: [SessionStatus]) -> [SessionRosterProjection.Row] {
        SessionRosterProjection.rows(
            from: statuses.enumerated()
                .map { RosterSessionFixture.session(id: "\($0.offset)", status: $0.element) },
            mainCheckout: main,
            now: now,
        )
    }

    private func msAgo(_ seconds: Int) -> Int {
        now.epochMs - seconds * 1000
    }
}

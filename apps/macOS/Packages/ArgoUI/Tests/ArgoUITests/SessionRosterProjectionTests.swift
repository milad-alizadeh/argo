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
            session(id: "older", status: .idle),
            session(id: "attention", status: .asking),
            session(id: "newer", status: .running),
        ]

        let rows = SessionRosterProjection.rows(from: sessions)

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
        let row = try #require(rows(session(id: "stopped", status: .stopped)).first)

        #expect(row.stateWord == "Stopped")
        #expect(row.announcement.contains("Stopped"))
    }

    @Test
    func `a Session with no word announces the rest of the row without it`() throws {
        let row = try #require(
            rows(session(id: "quiet", status: .idle, lastSeenAtMs: msAgo(120))).first,
        )

        // No empty slot where the word would have been, and the read-only fact — which the
        // lock is allowed to suppress visually — is never suppressed here.
        #expect(row.announcement == "Session quiet, on main, last active 2m ago")
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
    func `the lock is drawn only when read-only tells the rows apart`() {
        let mixed = SessionRosterProjection.rows(from: [
            session(id: "managed", access: .managed),
            session(id: "external", access: .readOnly),
        ])
        let uniform = SessionRosterProjection.rows(from: [
            session(id: "one", access: .readOnly),
            session(id: "two", access: .readOnly),
        ])

        #expect(mixed.map(\.showsLock) == [false, true])
        // Every Session read-only: the glyph distinguishes nothing, so it is the repeated
        // badge D30 deleted. The fact itself survives on every row.
        #expect(uniform.map(\.showsLock) == [false, false])
        #expect(uniform.map(\.isReadOnly) == [true, true])
    }

    @Test
    func `the row's second line is the branch its Session is on`() {
        // Two Sessions in one repo: the branch is the only thing on the row that tells them
        // apart, which is the whole reason it took the line the model used to have.
        let rows = SessionRosterProjection.rows(from: [
            session(id: "one", branch: "argo/#505-roster-row-branch"),
            session(id: "two", branch: "main"),
        ])

        #expect(rows.map(\.branch) == ["argo/#505-roster-row-branch", "main"])
    }

    @Test
    func `a Session with no branch carries no second line rather than a word for one`() throws {
        let row = try #require(SessionRosterProjection.rows(from: [
            session(id: "branchless", branch: nil),
        ]).first)

        // Absent, not the roster's `unknown`: a Session that has not branched has nothing to
        // say here, and a placeholder would read as a branch nobody can find.
        #expect(row.branch == nil)
    }

    @Test
    func `the full location survives the row even though it never draws on it`() {
        // The line is the branch, but copy-the-location and the row's tooltip still need the
        // path — dropping the workspace identity is a rendering decision, not a data one.
        let sessions = [
            session(id: "one", workspaceLocation: "/Users/milad/Client/argo"),
            session(id: "two", workspaceLocation: nil),
        ]

        let rows = SessionRosterProjection.rows(from: sessions)

        #expect(rows.map(\.location) == sessions.map(\.workspaceLocation))
    }

    @Test
    func `read-only Sessions carry no invented operational word`() throws {
        let row = try #require(SessionRosterProjection.rows(from: [
            session(id: "external", access: .readOnly, status: .unknown),
        ]).first)

        #expect(row.stateWord == nil)
        #expect(row.state == nil)
    }

    @Test
    func `the roster the specimen renders reaches every row rendering`() {
        // The `sessionRows` PNG is the only evidence roster states have, and it draws exactly
        // these rows. A preview presentation that stopped mixing access, or lost a status,
        // would silently narrow that evidence rather than fail anything.
        let rows = SessionRosterProjection.previewRows

        #expect(Set(rows.map(\.state)) == [.running, .attention, .idle, .failure, nil])
        // The locked row is also the long one: whether the lock holds its x while a title
        // truncates into it is the render question the PNG exists to settle, and a short
        // locked title would leave it unrendered without failing anything.
        #expect(rows.contains { $0.showsLock && $0.title.count > 40 })
        // Both branch renderings, for the same reason: a one-line row sitting between two-line
        // ones is a rhythm question, and a roster where every Session had a branch would leave
        // it unrendered.
        #expect(rows.contains { $0.branch == nil })
        // A real ticket branch, not a bare `main`: whether one truncates at the row's width
        // without losing the ticket it is named for is the other question the PNG settles.
        #expect(rows.contains { $0.branch?.hasPrefix("argo/#") == true })
        // A long branch beside an age, because whether the branch truncates rather than pushing
        // the age off the line is a layout claim no value test can see.
        #expect(rows.contains { ($0.branch?.count ?? 0) > 30 && $0.age != nil })
        // And a row with no age that is not simply the running one: the record-carried-no-time
        // rendering is the absence the roster has to draw, and the running row would satisfy a
        // bare `age == nil` on its own.
        #expect(rows.contains { $0.age == nil && $0.state != .running })
    }

    @Test
    func `an idle Session says how long ago it last moved`() throws {
        let row = try #require(rows(session(id: "idle", lastSeenAtMs: msAgo(120))).first)

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
        let row = try #require(rows(session(id: "idle", lastSeenAtMs: msAgo(secondsAgo))).first)

        #expect(row.age == phrase)
    }

    @Test
    func `a clock behind the record it is measuring against reads as no time at all`() throws {
        // Two machines' clocks, or one that moved: the record is allowed to be newer than the
        // read of the moment. `in 3m` would be the roster claiming the future.
        let row = try #require(rows(session(id: "skewed", lastSeenAtMs: msAgo(-180))).first)

        #expect(row.age == "just now")
    }

    @Test
    func `a running Session shows no age`() throws {
        let row = try #require(
            rows(session(id: "running", status: .running, lastSeenAtMs: msAgo(120))).first,
        )

        // The dot already says it is live, and the same `0m ago` repeated down the roster is
        // noise. Suppressed by the status, not by an absent time — this Session has one.
        #expect(row.age == nil)
    }

    @Test
    func `a Session whose record carries no activity time shows no age`() throws {
        let row = try #require(rows(session(id: "timeless", lastSeenAtMs: nil)).first)

        // Absence renders as absence. A placeholder would read as a moment nobody observed.
        #expect(row.age == nil)
    }

    private func rows(_ session: CockpitPresentation.Session) -> [SessionRosterProjection.Row] {
        SessionRosterProjection.rows(from: [session], now: now)
    }

    /// One row per status, in the order given, so a per-status mapping is asserted against
    /// the statuses it was written for rather than against seven anonymous slots.
    private func rows(of statuses: [SessionStatus]) -> [SessionRosterProjection.Row] {
        SessionRosterProjection.rows(
            from: statuses.enumerated().map { session(id: "\($0.offset)", status: $0.element) },
            now: now,
        )
    }

    private func session(
        id: String,
        workspaceLocation: String? = "/Users/milad/Developer/argo",
        branch: String? = "main",
        access: CockpitPresentation.Session.Access = .managed,
        status: SessionStatus = .idle,
        lastSeenAtMs: Int? = nil,
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: id,
            title: "Session \(id)",
            model: "claude-opus-5",
            workspaceLocation: workspaceLocation,
            branch: branch,
            access: access,
            status: status,
            lastSeenAtMs: lastSeenAtMs,
        )
    }

    private func msAgo(_ seconds: Int) -> Int {
        now.epochMs - seconds * 1000
    }
}

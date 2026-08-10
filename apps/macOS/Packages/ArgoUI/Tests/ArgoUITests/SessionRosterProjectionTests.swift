import ArgoEngine
@testable import ArgoUI
import Testing

@Suite("Session roster projection")
struct SessionRosterProjectionTests {
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
    func `a word is spent only where the roster wants the scan to stop`() {
        let sessions = [
            session(id: "idle", status: .idle),
            session(id: "running", status: .running),
            session(id: "attention", status: .asking),
            session(id: "failure", status: .stopped),
            session(id: "unknown", status: .unknown),
        ]

        let rows = SessionRosterProjection.rows(from: sessions)

        #expect(rows.map(\.stateWord) == [nil, nil, "Needs you", "Failed", nil])
    }

    @Test
    func `every Session status has one colour role, and unknown has none`() {
        // `allCases`, so a status added to the domain fails here rather than quietly taking
        // whichever colour the mapping's last branch happens to be.
        let rows = SessionRosterProjection.rows(
            from: SessionStatus.allCases.enumerated()
                .map { session(id: "\($0.offset)", status: $0.element) },
        )

        // A dot is a claim about what the Session is doing; `unknown` makes none.
        #expect(rows.map(\.state) == [
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
    }

    private func session(
        id: String,
        workspaceLocation: String? = "/Users/milad/Developer/argo",
        branch: String? = "main",
        access: CockpitPresentation.Session.Access = .managed,
        status: SessionStatus = .idle,
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
        )
    }
}

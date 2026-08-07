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
    func `workspace labels omit absolute paths and disambiguate duplicate names`() {
        let sessions = [
            session(id: "one", workspaceLocation: "/Users/milad/Client/argo"),
            session(id: "two", workspaceLocation: "/Users/milad/Labs/argo"),
            session(id: "three", workspaceLocation: "/Users/milad/Labs/cockpit"),
            session(id: "four", workspaceLocation: "/Users/milad/Labs/cockpit"),
        ]

        let rows = SessionRosterProjection.rows(from: sessions)

        #expect(rows.map(\.workspaceIdentity) == [
            "Client/argo", "Labs/argo", "cockpit", "cockpit",
        ])
        #expect(rows.allSatisfy { !$0.metadata.contains("/Users/") })
        #expect(rows.map(\.location) == sessions.map(\.workspaceLocation))
    }

    @Test
    func `a duplicated location never pushes a label out into the path it stands for`() {
        // The twin can never be told apart, and the third row wants the same leaf — the case
        // that used to fall through to the whole path in the visible metadata line.
        let rows = SessionRosterProjection.rows(from: [
            session(id: "twin-a", workspaceLocation: "/Users/milad/Labs/argo"),
            session(id: "twin-b", workspaceLocation: "/Users/milad/Labs/argo"),
            session(id: "other", workspaceLocation: "/Users/milad/Client/argo"),
        ])

        #expect(rows.map(\.workspaceIdentity) == ["Labs/argo", "Labs/argo", "Client/argo"])
        #expect(rows.allSatisfy { !$0.metadata.contains("/Users") })
        #expect(rows.allSatisfy { $0.workspaceIdentity.split(separator: "/").count <= 2 })
    }

    @Test
    func `a deep location is qualified by one parent, never by its whole path`() {
        let rows = SessionRosterProjection.rows(from: [
            session(id: "deep", workspaceLocation: "/Users/milad/a/b/c/d/argo"),
            session(id: "shallow", workspaceLocation: "/Users/milad/z/argo"),
        ])

        #expect(rows.map(\.workspaceIdentity) == ["d/argo", "z/argo"])
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
    func `a Session with no model reads as unknown rather than as a blank`() throws {
        let row = try #require(SessionRosterProjection.rows(from: [
            session(id: "external", model: nil),
        ]).first)

        #expect(row.metadata == "unknown · argo")
    }

    private func session(
        id: String,
        workspaceLocation: String = "/Users/milad/Developer/argo",
        access: CockpitPresentation.Session.Access = .managed,
        status: SessionStatus = .idle,
        model: String? = "claude-opus-5",
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: id,
            title: "Session \(id)",
            model: model,
            workspaceLocation: workspaceLocation,
            branch: "main",
            access: access,
            status: status,
        )
    }
}

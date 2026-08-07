@testable import ArgoUI
import Testing

@Suite("Session roster projection")
struct SessionRosterProjectionTests {
    @Test
    func `input order survives operational state changes`() {
        let sessions = [
            session(id: "older", state: .idle),
            session(id: "attention", state: .attention),
            session(id: "newer", state: .running),
        ]

        let rows = SessionRosterProjection.rows(from: sessions)

        #expect(rows.map(\.id) == ["older", "attention", "newer"])
        #expect(rows.map(\.state) == [.idle, .attention, .running])
    }

    @Test
    func `a word is spent only where the roster wants the scan to stop`() {
        let sessions = [
            session(id: "idle", state: .idle),
            session(id: "running", state: .running),
            session(id: "attention", state: .attention),
            session(id: "failure", state: .failure),
            session(id: "unknown", state: nil),
        ]

        let rows = SessionRosterProjection.rows(from: sessions)

        #expect(rows.map(\.stateWord) == [nil, nil, "Needs you", "Failed", nil])
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
    func `read-only Sessions carry no invented operational word`() throws {
        let row = try #require(SessionRosterProjection.rows(from: [
            session(id: "external", access: .readOnly, state: nil),
        ]).first)

        #expect(row.isReadOnly)
        #expect(row.stateWord == nil)
        #expect(row.state == nil)
        #expect(row.metadata == "claude-opus-5 · argo")
    }

    private func session(
        id: String,
        workspaceLocation: String = "/Users/milad/Developer/argo",
        access: CockpitPresentation.Session.Access = .managed,
        state: ArgoOperationalState? = .idle,
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: id,
            title: "Session \(id)",
            model: "claude-opus-5",
            workspaceLocation: workspaceLocation,
            branch: "main",
            access: access,
            operationalState: state,
        )
    }
}

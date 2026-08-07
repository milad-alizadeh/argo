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
        #expect(rows.map(\.stateWord) == ["idle", "needs you", "running"])
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

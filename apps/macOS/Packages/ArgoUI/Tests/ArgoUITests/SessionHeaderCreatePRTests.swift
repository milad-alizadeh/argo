import ArgoEngine
@testable import ArgoUI
import Testing

/// Whether the header offers **Create PR** (#1335) — a managed Session only
/// (`cockpit-roster-row.md`, decision 6): an external or orphaned one has no terminal to type
/// `/ship` into.
@Suite("Session header Create PR")
struct SessionHeaderCreatePRTests {
    @Test
    func `a managed Session is offered Create PR`() {
        #expect(header(access: .managed).showsCreatePR)
    }

    @Test
    func `an external or orphaned Session is offered nothing`() {
        #expect(!header(access: .external).showsCreatePR)
        #expect(!header(access: .orphaned).showsCreatePR)
    }

    private func header(
        access: CockpitPresentation.Session.Access,
    )
        -> SessionHeaderProjection.Header {
        SessionHeaderProjection.header(from: CockpitPresentation.Session(
            id: "session",
            title: "Session",
            access: access,
            status: .idle,
            work: .init(location: "/Users/milad/Developer/argo", workspace: .init(branch: "main")),
        ))
    }
}

import ArgoDesign
import ArgoEngine
@testable import ArgoUI
import Testing

/// Whether the header offers **Create PR** (#1335) — a managed Session only
/// (`cockpit-roster-row.md`, decision 6): an external or orphaned one has no terminal to type
/// `/ship` into — and the ink it is offered in (#1575), which is the other half of the rule:
/// presence is the whole of what the control reports, so the ink may not report anything on top
/// of it.
@Suite("Session header Create PR")
struct SessionHeaderCreatePullRequestTests {
    @Test
    func `a managed Session is offered Create PR`() {
        #expect(header(access: .managed).showsCreatePullRequest)
    }

    @Test
    func `an external or orphaned Session is offered nothing`() {
        #expect(!header(access: .external).showsCreatePullRequest)
        #expect(!header(access: .orphaned).showsCreatePullRequest)
    }

    /// The label the capsule is handed, which is the ink the control is drawn in. An accent here
    /// is a permanent call to action on a Session asserting nothing; the verdict is the roster's
    /// `Ready` badge, gated three ways this control is not.
    @Test
    func `the drawn label takes the ordinary control ink, never the accent`() {
        let palette = ArgoPalette.graphite
        let label = CreatePullRequestButton.label(in: palette)
        #expect(label.word == "Create PR")
        #expect(label.ink == palette.text.secondary)
        #expect(label.ink != palette.interaction.accent)
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

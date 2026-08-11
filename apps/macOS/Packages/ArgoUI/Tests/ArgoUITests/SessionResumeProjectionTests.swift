@testable import ArgoUI
import Testing

/// Which selection costs a process (#10). Selection has always been free, and this ticket makes it
/// side-effecting for exactly one case — so every other case is a test here.
@Suite("Session resume projection")
struct SessionResumeProjectionTests {
    private func presentation(
        _ access: CockpitPresentation.Session.Access,
    )
        -> CockpitPresentation {
        CockpitPresentation(
            projects: [],
            activeProjectID: nil,
            sessions: [RosterSessionFixture.session(id: "a", access: access)],
            checkout: .unavailable,
            connection: .idle,
        )
    }

    /// The whole ticket: Argo spawned this Session, lost the PTY with the process that owned it,
    /// and picking the row is what asks for it back.
    @Test
    func `picking a Session Argo lost resumes it`() {
        let resumable = SessionResumeProjection.resumable("a", in: presentation(.orphaned))

        #expect(resumable == "a")
    }

    /// Both are inert, for opposite reasons: `managed` is already reachable, and `external`
    /// belongs to whoever started it.
    @Test(arguments: [
        CockpitPresentation.Session.Access.managed,
        CockpitPresentation.Session.Access.external,
    ])
    func `picking any other Session spends nothing`(
        access: CockpitPresentation.Session.Access,
    ) {
        #expect(SessionResumeProjection.resumable("a", in: presentation(access)) == nil)
    }

    /// The state a launch is in before anything is picked, and the one a repointed roster leaves
    /// behind — neither may start an agent.
    @Test
    func `picking nothing resumes nothing`() {
        #expect(SessionResumeProjection.resumable(nil, in: presentation(.orphaned)) == nil)
    }

    @Test
    func `a Session no longer on the roster resumes nothing`() {
        #expect(SessionResumeProjection.resumable("gone", in: presentation(.orphaned)) == nil)
    }
}

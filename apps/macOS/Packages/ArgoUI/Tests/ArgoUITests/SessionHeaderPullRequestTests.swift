import ArgoEngine
@testable import ArgoUI
import Testing

/// The header's own reading of the branch's pull request (#1592) — a slot on the projection
/// rather than a second join, and the fact `announcement` must carry for a screen reader that
/// never visits the tab line's own link.
@Suite("Session header pull request")
struct SessionHeaderPullRequestTests {
    @Test
    func `the header carries the branch's pull request straight through`() {
        let pullRequest = DeliveryPullRequest.fixture(number: 1589, state: "open")
        #expect(header(pullRequest: pullRequest).pullRequest == pullRequest)
    }

    @Test
    func `a branch with none open carries nothing`() {
        #expect(header(pullRequest: nil).pullRequest == nil)
    }

    @Test
    func `the announcement spells the word, between the issue and the checkout`() {
        let announced = header(pullRequest: .fixture(number: 1589, state: "open")).announcement

        #expect(announced.contains("Issue #510, PR #1589, On main"))
    }

    @Test
    func `a branch with none open says nothing about a pull request`() {
        #expect(!header(pullRequest: nil).announcement.contains("PR"))
    }

    private func header(
        pullRequest: DeliveryPullRequest?,
    )
        -> SessionHeaderProjection.Header {
        SessionHeaderProjection.header(from: CockpitPresentation.Session(
            id: "session",
            title: "Session",
            access: .managed,
            status: .idle,
            work: .init(
                location: "/Users/milad/Developer/argo",
                workspace: .init(branch: "main"),
                ticket: .linked(.init(number: 510)),
                delivery: .init(pullRequest: pullRequest),
            ),
        ))
    }
}

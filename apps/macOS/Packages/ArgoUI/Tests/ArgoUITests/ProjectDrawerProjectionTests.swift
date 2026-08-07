@testable import ArgoUI
import Testing

/// What the drawer says about the registered set. Every claim here is one the drawer must make in
/// WORDS — a dashed edge and a tinted dot are not readable by everyone, and neither is testable.
@Suite("Project drawer projection")
struct ProjectDrawerProjectionTests {
    @Test
    func `every registered Project is one row, in the order the registry holds them`() {
        let rows = ProjectDrawerProjection.rows(from: presentation())

        #expect(rows.map(\.id) == ["argo", "cockpit", "moved"])
        #expect(rows.map(\.name) == ["argo", "cockpit", "penumbra"])
    }

    @Test
    func `a reachable Project shows the folder it is registered at`() throws {
        let row = try #require(ProjectDrawerProjection.rows(from: presentation()).first)

        #expect(row.detail == "/Users/milad/Developer/argo")
        #expect(row.isReachable)
    }

    /// The Project has not stopped existing — its folder has moved — so it keeps its place and
    /// says so, rather than dropping out of the set.
    @Test
    func `an unreachable Project keeps its position and states folder not found`() throws {
        let rows = ProjectDrawerProjection.rows(from: presentation())
        let row = try #require(rows.last)

        #expect(rows.count == 3)
        #expect(row.detail == "folder not found")
        #expect(row.accessibilityLabel.contains("folder not found"))
    }

    @Test
    func `the active Project is the one marked, and only that one`() {
        let rows = ProjectDrawerProjection.rows(from: presentation(activeProjectID: "cockpit"))

        #expect(rows.map(\.isActive) == [false, true, false])
    }

    @Test
    func `a Project nothing has observed carries no session count at all`() {
        let unobserved = CockpitPresentation.Project(
            id: "cockpit",
            name: "cockpit",
            location: "/Users/milad/Developer/cockpit",
        )

        let rows = ProjectDrawerProjection.rows(from: presentation(projects: [unobserved]))

        // Not "0 live": the Hub is pointed at one Project, and a count for any other is a fact
        // Argo does not have.
        #expect(rows.map(\.liveSessions) == [nil])
        #expect(rows.map(\.accessibilityLabel) == ["Project, cockpit"])
    }

    @Test
    func `an observed Project counts its live Sessions in words`() {
        let counted = CockpitPresentation.Project(
            id: "argo",
            name: "argo",
            location: "/Users/milad/Developer/argo",
            liveSessionCount: 3,
        )

        let rows = ProjectDrawerProjection.rows(from: presentation(projects: [counted]))

        #expect(rows.map(\.liveSessions) == ["3 live"])
        #expect(rows.map(\.accessibilityLabel) == ["Project, argo, 3 live Sessions"])
    }

    @Test
    func `an observed Project with nothing running says so rather than going quiet`() {
        let counted = CockpitPresentation.Project(
            id: "argo",
            name: "argo",
            location: "/Users/milad/Developer/argo",
            liveSessionCount: 0,
        )

        let rows = ProjectDrawerProjection.rows(from: presentation(projects: [counted]))

        #expect(rows.map(\.liveSessions) == ["0 live"])
        #expect(rows.map(\.accessibilityLabel) == ["Project, argo, no live Sessions"])
    }

    @Test
    func `one live Session is one Session, not one Sessions`() {
        let counted = CockpitPresentation.Project(
            id: "argo",
            name: "argo",
            location: "/tmp/argo",
            liveSessionCount: 1,
        )

        let rows = ProjectDrawerProjection.rows(from: presentation(projects: [counted]))

        #expect(rows.map(\.accessibilityLabel) == ["Project, argo, 1 live Session"])
    }

    /// A `--project` launch draws where the window points, but there is no record behind that row
    /// — so the verbs that read or write one do not apply to it.
    @Test
    func `a Project nobody registered is drawn, and carries no management verbs`() {
        let pointed = CockpitPresentation.Project(
            id: "/tmp/pointed",
            name: "pointed",
            location: "/tmp/pointed",
            isRegistered: false,
        )

        let rows = ProjectDrawerProjection.rows(from: presentation(projects: [pointed]))

        #expect(rows.map(\.name) == ["pointed"])
        #expect(rows.map(\.isRegistered) == [false])
    }

    @Test
    func `a registered Project carries them`() {
        let rows = ProjectDrawerProjection.rows(from: presentation())

        #expect(rows.map(\.isRegistered) == [true, true, true])
    }

    @Test
    func `a machine that has registered nothing draws no rows`() {
        #expect(ProjectDrawerProjection.rows(from: .unregisteredPreview).isEmpty)
    }

    private func presentation(
        projects: [CockpitPresentation.Project] = CockpitPresentation.previewProjects,
        activeProjectID: String? = "argo",
    )
        -> CockpitPresentation {
        CockpitPresentation(
            projects: projects,
            activeProjectID: activeProjectID,
            sessions: [],
            checkout: .unavailable,
            connection: .idle,
        )
    }
}

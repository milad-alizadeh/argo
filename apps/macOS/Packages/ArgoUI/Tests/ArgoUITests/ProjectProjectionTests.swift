import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// What the shell can say about the registered SET, as opposed to about one Session.
///
/// The re-point itself is the Hub's own claim and is tested there (`Hub observation` — "re-pointing
/// at another Project drops the previous one entirely"). What is tested here is that the shell
/// reads that answer rather than keeping one of its own.
@Suite("Project projection")
struct ProjectProjectionTests {
    @Test
    @MainActor
    func `the Project the Hub is on counts the Sessions it is reading`() async {
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp/argo"))
        await observe(hub, id: "live")

        let projection = presentation(of: hub)

        #expect(projection.activeProject?.liveSessionCount == 1)
    }

    /// Not zero: the Hub is pointed at one Project, so a count for any other is a fact Argo does
    /// not have, and a zero would read as "nothing is running here".
    @Test
    @MainActor
    func `a Project the Hub is not on carries no count at all`() async {
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp/argo"))
        await observe(hub, id: "live")

        let projection = presentation(of: hub)

        #expect(projection.projects.map(\.liveSessionCount) == [1, nil])
    }

    /// Roster, checkout and connection are read from the Hub every time, so the teardown half of a
    /// switch takes all three together — no row of the Project being left can survive it.
    @Test
    @MainActor
    func `nothing of the Project being left survives into the projection`() async {
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp/argo"))
        await observe(hub, id: "live")
        #expect(presentation(of: hub).sessions.count == 1)

        await hub.disconnect()
        let switched = presentation(of: hub, activeProjectID: "cockpit")

        #expect(switched.sessions.isEmpty)
        #expect(switched.checkout == CheckoutProjection.Head.unavailable)
        #expect(switched.activeProject?.name == "cockpit")
        #expect(switched.activeProject?.liveSessionCount == 0)
    }

    /// A launch pointed at a folder nobody registered still has to render where the window is.
    @Test
    @MainActor
    func `a Project nobody registered still projects as the active one`() {
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp/unregistered"))
        let unregistered = CockpitPresentation.Project(
            id: "/tmp/unregistered",
            name: "unregistered",
            location: "/tmp/unregistered",
        )

        let projection = CockpitPresentation(
            projects: [unregistered],
            activeProjectID: unregistered.id,
            hub: hub,
        )

        #expect(projection.activeProject?.name == "unregistered")
    }

    @MainActor
    private func presentation(
        of hub: Hub,
        activeProjectID: String = "argo",
    )
        -> CockpitPresentation {
        CockpitPresentation(
            projects: [
                CockpitPresentation.Project(id: "argo", name: "argo", location: "/tmp/argo"),
                CockpitPresentation.Project(
                    id: "cockpit",
                    name: "cockpit",
                    location: "/tmp/cockpit",
                ),
            ],
            activeProjectID: activeProjectID,
            hub: hub,
        )
    }

    /// Drive one finite transcript into the Hub and yield until its row is there.
    @MainActor
    private func observe(_ hub: Hub, id: String) async {
        let stream = AsyncStream<TranscriptEvent> { continuation in
            continuation.yield(.cwd("/tmp/argo"))
            continuation.yield(.prompt(text: "Work on it", atMs: nil))
            continuation.yield(.turnEnded(.endTurn))
            continuation.finish()
        }
        await hub.startObserving(TranscriptObservation(
            id: id,
            sourceURL: URL(fileURLWithPath: "/tmp/\(id).jsonl"),
            events: stream,
        ))
        for _ in 0 ..< 200 where hub.sessions.first?.status != .idle {
            await Task.yield()
        }
    }
}

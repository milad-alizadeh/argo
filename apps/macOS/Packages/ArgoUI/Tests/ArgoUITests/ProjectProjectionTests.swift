import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// What the shell can say about the registered SET, as opposed to about one Session. The re-point
/// itself is the Hub's claim and is tested in `Hub observation`; here the shell must read that
/// answer rather than keep one of its own.
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
    /// not have.
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

    /// At the head, and there for the window's life rather than only while it is active: it is the
    /// only way back to where the process was pointed.
    @Test
    @MainActor
    func `the folder a launch was pointed at heads the strip, unregistered`() {
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp/unregistered"))
        let pointing = CockpitPointing(
            registry: ProjectRegistry(projects: [argo], activeProjectID: argo.id),
            launch: .registered(argo),
            launchOrigin: .unregistered(URL(fileURLWithPath: "/tmp/unregistered")),
        )

        let projection = CockpitPresentation(pointing: pointing, hub: hub)

        #expect(projection.projects.map(\.id) == ["/tmp/unregistered", "argo"])
        #expect(projection.projects.map(\.isRegistered) == [false, true])
        // The window is on the record, and the launch's own folder is still a mark to go back to.
        #expect(projection.activeProject?.id == argo.id)
    }

    /// A launch that resolved to a record has nothing extra to draw — otherwise the strip would
    /// show the same repository twice, once selected and once not.
    @Test
    @MainActor
    func `a launch that resolved to a registered Project adds no second mark`() {
        let hub = Hub(projectURL: argo.url)
        let pointing = CockpitPointing(
            registry: ProjectRegistry(projects: [argo], activeProjectID: argo.id),
            launch: .registered(argo),
            launchOrigin: .registered(argo),
        )

        let projection = CockpitPresentation(pointing: pointing, hub: hub)

        #expect(projection.projects.map(\.id) == ["argo"])
    }

    private var argo: ProjectRecord {
        ProjectRecord(id: "argo", path: "/tmp/argo")
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
        // One batch, which is how a tail hands over a file it has finished reading.
        let stream = AsyncStream<[TranscriptEvent]> { continuation in
            continuation.yield([
                .cwd("/tmp/argo"),
                .prompt(text: "Work on it", images: [], atMs: nil),
                .turnEnded(.endTurn),
            ])
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

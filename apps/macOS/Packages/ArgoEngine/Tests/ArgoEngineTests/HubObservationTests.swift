@testable import ArgoEngine
import Foundation
import Testing

/// Starting and stopping observation: one tail at a time for discovery, all of them at once for a
/// Project switch.
@Suite("Hub observation")
struct HubObservationTests {
    private static let firstProjectURL = URL(fileURLWithPath: "/tmp/argo-first")
    private static let secondProjectURL = URL(fileURLWithPath: "/tmp/argo-second")

    @Test
    @MainActor
    func `stopping one observation leaves the others tailing`() async {
        let hub = Hub(projectURL: Self.firstProjectURL)
        let (dropped, droppedEvents) = hubLiveObservation(id: "dropped")
        let (kept, keptEvents) = hubLiveObservation(id: "kept")

        await hub.startObserving(dropped)
        await hub.startObserving(kept)
        droppedEvents.yield(.title("Dropped"))
        await hub.stopObserving(transcriptID: "dropped")
        keptEvents.yield(.title("Still tailing"))
        keptEvents.finish()
        await hub.waitForObservation(transcriptID: "kept")

        #expect(hub.liveTailCount == 1)
        #expect(hub.sessions.map(\.id) == ["kept"])
        #expect(hub.sessions[0].title == "Still tailing")
        await hub.disconnect()
    }

    @Test
    @MainActor
    func `a stopped observation applies no further event`() async {
        let hub = Hub(projectURL: Self.firstProjectURL)
        let (first, firstEvents) = hubLiveObservation(id: "session")

        await hub.startObserving(first)
        await hub.stopObserving(transcriptID: "session")
        firstEvents.yield(.title("After the stop"))
        firstEvents.yield(.cwd("/tmp/after-the-stop"))
        firstEvents.finish()

        // Restarted under the SAME id, which is the case a token guards and a cancellation check
        // does not: an event of the dead tail applying here would be indistinguishable from one of
        // the live one.
        let (second, secondEvents) = hubLiveObservation(id: "session")
        await hub.startObserving(second)
        secondEvents.yield(.title("Fresh"))
        secondEvents.finish()
        await hub.waitForObservation(transcriptID: "session")

        #expect(hub.sessions.count == 1)
        #expect(hub.sessions[0].title == "Fresh")
        #expect(hub.sessions[0].cwd == nil)
        await hub.disconnect()
    }

    @Test
    @MainActor
    func `re-pointing at another Project drops the previous one entirely`() async throws {
        let hub = Hub(projectURL: Self.firstProjectURL)
        let engine = Engine()
        let second = try hubFixtureURL("prose")

        try await hub.connect(using: engine, configuration: LaunchConfiguration(
            projectURL: Self.firstProjectURL,
            transcriptURLs: [hubFixtureURL("externalBasic")],
        ))
        await hub.connect(using: engine, configuration: LaunchConfiguration(
            projectURL: Self.secondProjectURL,
            transcriptURLs: [second],
        ))

        #expect(hub.project.url == Self.secondProjectURL)
        #expect(hub.sessions.map(\.sourceURL) == [second.standardizedFileURL])
        #expect(hub.liveTailCount == 1)
        await hub.disconnect()
        #expect(hub.sessions.isEmpty)
        #expect(hub.liveTailCount == 0)
        #expect(hub.checkout == .unavailable)
    }

    @Test
    @MainActor
    func `re-pointing repeatedly leaves no growing set of tails`() async throws {
        let hub = Hub(projectURL: Self.firstProjectURL)
        let engine = Engine()
        let configuration = try LaunchConfiguration(
            projectURL: Self.firstProjectURL,
            transcriptURLs: [hubFixtureURL("externalBasic"), hubFixtureURL("prose")],
        )

        for _ in 0 ..< 5 {
            await hub.connect(using: engine, configuration: configuration)
            #expect(hub.liveTailCount == 2)
        }

        await hub.disconnect()
        #expect(hub.liveTailCount == 0)
    }

    /// The interleaved case: events of the previous Project are already buffered and unread at the
    /// moment it is dropped.
    @Test
    @MainActor
    func `an event in flight at re-point never reaches the rebuilt join`() async throws {
        let hub = Hub(projectURL: Self.firstProjectURL)
        let (previous, previousEvents) = hubLiveObservation(id: "previous")

        await hub.startObserving(previous)
        previousEvents.yield(.title("Previous Project"))
        previousEvents.yield(.cwd("/tmp/argo-first"))
        try await hub.connect(using: Engine(), configuration: LaunchConfiguration(
            projectURL: Self.secondProjectURL,
            transcriptURLs: [hubFixtureURL("prose")],
        ))
        previousEvents.yield(.title("Straggler"))
        previousEvents.finish()
        await Task.yield()

        #expect(hub.sessions.allSatisfy { $0.id != "previous" })
        #expect(hub.sessions.allSatisfy { $0.title != "Straggler" })
        #expect(hub.liveTailCount == 1)
        await hub.disconnect()
    }

    /// A file-backed tail never finishes on its own, so a `connect` that still awaited the group
    /// would hang here rather than fail.
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `connect returns while its tails are still running`() async throws {
        let hub = Hub(projectURL: Self.firstProjectURL)

        try await hub.connect(using: Engine(), configuration: LaunchConfiguration(
            projectURL: Self.firstProjectURL,
            transcriptURLs: [hubFixtureURL("externalBasic")],
        ))

        #expect(hub.liveTailCount == 1)
        #expect(hub.connection == .healthy)
        await hub.disconnect()
    }

    /// The file handle a real tail holds is closed on the stream's termination callback, so a
    /// stream that terminates on stop is the assertion that no handle is left open.
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `stopping an observation tears its stream down`() async {
        let hub = Hub(projectURL: Self.firstProjectURL)
        let (observation, events) = hubLiveObservation(id: "session")
        let (terminations, terminated) = AsyncStream<Void>.makeStream()
        events.onTermination = { _ in terminated.finish() }

        await hub.startObserving(observation)
        await hub.stopObserving(transcriptID: "session")

        for await _ in terminations {}
        #expect(hub.liveTailCount == 0)
    }
}

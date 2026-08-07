@testable import ArgoEngine
import Foundation
import Testing

/// Starting and stopping observation: one tail at a time for discovery, all of them at once for a
/// Project switch.
@Suite("Hub observation")
struct HubObservationTests {
    private static let firstProjectURL = URL(fileURLWithPath: "/tmp/argo-first")
    private static let secondProjectURL = URL(fileURLWithPath: "/tmp/argo-second")
    /// One tail opens the cursor's read handle and the watcher's `O_EVTONLY` descriptor.
    private static let descriptorsPerTail = 2

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

        #expect(hub.liveObservationCount == 1)
        #expect(hub.sessions.map(\.id) == ["kept"])
        #expect(hub.sessions[0].title == "Still tailing")
        await hub.disconnect()
    }

    /// The event yielded after the stop is buffered against a stream nobody is reading, and the id
    /// it was read under is then handed to a different transcript. Applying it would be
    /// indistinguishable from applying the live one's, which is why the stop has to have finished
    /// the old tail rather than only asked it to end.
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

        await hub.connect(using: engine, configuration: LaunchConfiguration(
            projectURL: Self.firstProjectURL,
            transcriptURLs: [FileManager.default.temporaryDirectory.appending(path: "absent")],
        ))
        #expect(hub.connection == .failed(message: "Transcript unavailable"))

        await hub.connect(using: engine, configuration: LaunchConfiguration(
            projectURL: Self.secondProjectURL,
            transcriptURLs: [second],
        ))

        #expect(hub.project.url == Self.secondProjectURL)
        #expect(hub.sessions.map(\.sourceURL) == [second.standardizedFileURL])
        #expect(hub.connection == .healthy)
        #expect(hub.liveObservationCount == 1)
        await hub.disconnect()
        #expect(hub.sessions.isEmpty)
        #expect(hub.liveObservationCount == 0)
        #expect(hub.checkout == .unavailable)
    }

    @Test
    @MainActor
    func `re-pointing repeatedly leaves no growing set of tasks`() async throws {
        let hub = Hub(projectURL: Self.firstProjectURL)
        let engine = Engine()
        let configuration = try LaunchConfiguration(
            projectURL: Self.firstProjectURL,
            transcriptURLs: [hubFixtureURL("externalBasic"), hubFixtureURL("prose")],
        )

        for _ in 0 ..< 5 {
            await hub.connect(using: engine, configuration: configuration)
            #expect(hub.liveObservationCount == 2)
        }

        await hub.disconnect()
        #expect(hub.liveObservationCount == 0)
    }

    /// The other half of that: a tail holds the cursor's handle and the watcher's descriptor, and
    /// neither is visible in the task count. Five re-points that leaked would leave eight open.
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `re-pointing repeatedly leaves no open descriptor on the transcript`() async throws {
        let transcriptURL = FileManager.default.temporaryDirectory
            .appending(path: "\(UUID().uuidString).jsonl")
        try Data("{}\n".utf8).write(to: transcriptURL)
        defer { try? FileManager.default.removeItem(at: transcriptURL) }
        let hub = Hub(projectURL: Self.firstProjectURL)
        let configuration = LaunchConfiguration(
            projectURL: Self.firstProjectURL,
            transcriptURLs: [transcriptURL],
        )

        for _ in 0 ..< 5 {
            await hub.connect(using: Engine(), configuration: configuration)
            // Asserted every round, so a count that reads zero because the probe is blind fails
            // here rather than passing the teardown assertion for the wrong reason.
            await settle { openDescriptorCount(for: transcriptURL) > 0 }
            #expect(openDescriptorCount(for: transcriptURL) == Self.descriptorsPerTail)
        }
        await hub.disconnect()

        // The cursor closes itself from the stream's termination handler, which cannot await, so
        // the last close lands a hop after `disconnect` returns rather than inside it.
        await settle { openDescriptorCount(for: transcriptURL) == 0 }
        #expect(openDescriptorCount(for: transcriptURL) == 0)
    }

    /// The interleaved case: events of the previous Project are buffered and unread at the moment
    /// it is dropped, and one more arrives after the new Project's roster is already standing.
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
        #expect(hub.liveObservationCount == 1)
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

        #expect(hub.liveObservationCount == 1)
        #expect(hub.connection == .healthy)
        await hub.disconnect()
    }
}

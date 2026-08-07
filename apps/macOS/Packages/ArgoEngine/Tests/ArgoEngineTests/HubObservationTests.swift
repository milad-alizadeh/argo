@testable import ArgoEngine
import Foundation
import Testing

/// Starting and stopping observation: one tail at a time for discovery, all of them at once for a
/// Project switch. Asserted through `hub.observations` — the projection the cockpit reads — rather
/// than through a count kept for the tests.
@Suite("Hub observation")
struct HubObservationTests {
    private static let firstProjectURL = URL(fileURLWithPath: "/tmp/argo-first")
    private static let secondProjectURL = URL(fileURLWithPath: "/tmp/argo-second")
    /// One tail opens the cursor's read handle and the watcher's `O_EVTONLY` descriptor.
    private static let descriptorsPerTail = 2

    @Test
    @MainActor
    func `stopping one observation leaves the others tailing`() async {
        let hub = testHub(projectURL: Self.firstProjectURL)
        let (dropped, droppedEvents) = hubLiveObservation(id: "dropped")
        let (kept, keptEvents) = hubLiveObservation(id: "kept")

        await hub.startObserving(dropped)
        await hub.startObserving(kept)
        droppedEvents.yield([.title("Dropped")])
        await hub.stopObserving(transcriptID: "dropped")
        keptEvents.yield([.title("Still tailing")])
        keptEvents.finish()
        await hubTailEnded(hub, transcriptID: "kept")

        #expect(hub.observations.map(\.id) == ["kept"])
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
        let hub = testHub(projectURL: Self.firstProjectURL)
        let (first, firstEvents) = hubLiveObservation(id: "session")

        await hub.startObserving(first)
        await hub.stopObserving(transcriptID: "session")
        firstEvents.yield([.title("After the stop")])
        firstEvents.yield([.cwd("/tmp/after-the-stop")])
        firstEvents.finish()

        let (second, secondEvents) = hubLiveObservation(id: "session")
        await hub.startObserving(second)
        secondEvents.yield([.title("Fresh")])
        secondEvents.finish()
        await hubTailEnded(hub, transcriptID: "session")

        #expect(hub.sessions.count == 1)
        #expect(hub.sessions[0].title == "Fresh")
        #expect(hub.sessions[0].cwd == nil)
        await hub.disconnect()
    }

    @Test
    @MainActor
    func `re-pointing at another Project drops the previous one entirely`() async throws {
        let hub = testHub(projectURL: Self.firstProjectURL)
        let second = try hubFixtureURL("prose")

        await hub.connect(to: LaunchConfiguration(
            projectURL: Self.firstProjectURL,
            transcriptURLs: [FileManager.default.temporaryDirectory.appending(path: "absent")],
        ))
        #expect(hub.connection == .failed(message: "Transcript unavailable"))

        await hub.connect(to: LaunchConfiguration(
            projectURL: Self.secondProjectURL,
            transcriptURLs: [second],
        ))

        #expect(hub.project.url == Self.secondProjectURL)
        await hubSettle { !hub.sessions.isEmpty }
        #expect(hub.sessions.map(\.sourceURL) == [second.standardizedFileURL])
        #expect(hub.connection == .connected)
        #expect(hub.observations.map(\.state) == [.live])
        await hub.disconnect()
        #expect(hub.sessions.isEmpty)
        #expect(hub.observations.isEmpty)
        #expect(hub.checkout == .unavailable)
    }

    @Test
    @MainActor
    func `re-pointing repeatedly leaves no growing set of tasks`() async throws {
        let hub = testHub(projectURL: Self.firstProjectURL)
        let configuration = try LaunchConfiguration(
            projectURL: Self.firstProjectURL,
            transcriptURLs: [hubFixtureURL("externalBasic"), hubFixtureURL("prose")],
        )

        for _ in 0 ..< 5 {
            await hub.connect(to: configuration)
            #expect(hub.observations.map(\.state) == [.live, .live])
        }

        await hub.disconnect()
        #expect(hub.observations.isEmpty)
    }

    /// The other half of that: a tail holds the cursor's handle and the watcher's descriptor, and
    /// neither is visible in the projection. Five re-points that leaked would leave eight open.
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `re-pointing repeatedly leaves no open descriptor on the transcript`() async throws {
        let transcriptURL = FileManager.default.temporaryDirectory
            .appending(path: "\(UUID().uuidString).jsonl")
        try Data("{}\n".utf8).write(to: transcriptURL)
        defer { try? FileManager.default.removeItem(at: transcriptURL) }
        let hub = testHub(projectURL: Self.firstProjectURL)
        let configuration = LaunchConfiguration(
            projectURL: Self.firstProjectURL,
            transcriptURLs: [transcriptURL],
        )

        for _ in 0 ..< 5 {
            await hub.connect(to: configuration)
            // Asserted every round, so a count that reads zero because the probe is blind fails
            // here rather than passing the teardown assertion for the wrong reason. Waited for on
            // the exact count: the two descriptors are opened a hop apart, and settling on "any"
            // catches the tail half-open.
            let tailing = await settle {
                openDescriptorCount(for: transcriptURL) == Self.descriptorsPerTail
            }
            #expect(tailing, "saw \(openDescriptorCount(for: transcriptURL)) descriptors open")
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
        let hub = testHub(projectURL: Self.firstProjectURL)
        let (previous, previousEvents) = hubLiveObservation(id: "previous")

        await hub.startObserving(previous)
        previousEvents.yield([.title("Previous Project"), .cwd("/tmp/argo-first")])
        try await hub.connect(to: LaunchConfiguration(
            projectURL: Self.secondProjectURL,
            transcriptURLs: [hubFixtureURL("prose")],
        ))
        previousEvents.yield([.title("Straggler")])
        previousEvents.finish()
        await Task.yield()

        #expect(hub.sessions.allSatisfy { $0.id != "previous" })
        #expect(hub.sessions.allSatisfy { $0.title != "Straggler" })
        #expect(hub.observations.map(\.state) == [.live])
        await hub.disconnect()
    }

    /// A file-backed tail never finishes on its own, so a `connect` that still awaited the group
    /// would hang here rather than fail.
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `connect returns while its tails are still running`() async throws {
        let hub = testHub(projectURL: Self.firstProjectURL)

        try await hub.connect(to: LaunchConfiguration(
            projectURL: Self.firstProjectURL,
            transcriptURLs: [hubFixtureURL("externalBasic")],
        ))

        #expect(hub.observations.map(\.state) == [.live])
        #expect(hub.connection == .connected)
        await hub.disconnect()
    }
}

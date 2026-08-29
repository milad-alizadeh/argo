@testable import ArgoEngine
import Foundation
import Testing

/// The watch driven directly, on the two things it owns that no Hub test reaches: the join it keeps
/// for a Project pointed away from, and the failure it is left holding once nothing is being read.
@Suite("Transcript watch")
@MainActor
struct TranscriptWatchTests {
    private static let project = "/tmp/argo-watch-one"

    @Test
    func `a Project pointed away from and back keeps the roster it had`() async {
        let watch = await Self.watching("kept")

        watch.retain(for: Self.project)
        await watch.stopAll()
        #expect(watch.sessions.isEmpty)
        watch.restore(for: Self.project)

        #expect(watch.sessions.map(\.id) == ["kept"])
    }

    @Test
    func `a Project never pointed at starts empty, not on somebody else's roster`() async {
        let watch = await Self.watching("kept")
        watch.retain(for: Self.project)
        await watch.stopAll()

        watch.restore(for: "/tmp/argo-watch-two")

        #expect(watch.sessions.isEmpty)
    }

    /// Taken rather than copied: a join left in the cache after it was restored would be put back
    /// over whatever the live read has since made of it.
    @Test
    func `a retained join is taken, so nothing restores it twice`() async {
        let watch = await Self.watching("kept")
        watch.retain(for: Self.project)
        await watch.stopAll()
        watch.restore(for: Self.project)

        await watch.stopAll()
        watch.restore(for: Self.project)

        #expect(watch.sessions.isEmpty)
    }

    /// A failure is a claim about what could not be read. With every tail stopped there is no
    /// reading left for it to be about, and one left standing would offer a retry over an idle Hub.
    @Test
    func `stopping every tail drops the failure it was left holding`() async {
        let watch = Self.watch()
        let absent = FileManager.default.temporaryDirectory.appending(path: "argo-watch-absent")
        await watch.observeNamed([absent])
        #expect(watch.connection == .failed(message: "Transcript unavailable"))

        await watch.stopAll()

        #expect(watch.connection == .idle)
    }

    /// A watch reading one transcript to the end, so every case above starts from a standing
    /// roster rather than from the emptiness a tail is held back behind.
    private static func watching(_ id: String) async -> TranscriptWatch {
        let watch = watch()
        await watch.startObserving(hubTestObservation(id: id, events: [.title("Kept")]))
        let read = await settle { watch.sessions.map(\.id) == [id] }
        #expect(read, "the tail on \(id) never reached the roster")
        return watch
    }

    private static func watch() -> TranscriptWatch {
        TranscriptWatch(
            engine: Engine(reads: .init(
                checkout: CheckoutFixture().read,
                liveness: noLiveProcesses,
            )),
            discovery: SessionDiscovery(),
        )
    }
}

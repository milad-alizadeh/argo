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

    /// Two admits of ONE transcript, interleaving at their own suspension points — the click that
    /// selects a Session (`readWhole` → `reopen`) landing across a sweep's `move(onto:)`.
    ///
    /// `tail` waits for the previous tail to end before it can register the one it starts, so the
    /// second admit finds the table already empty, registers first, and is then overwritten by the
    /// first — which leaves its tail running with nothing referring to it. Both then read the same
    /// file and every live batch lands in the reading twice (#1237).
    @Test
    func `two admits racing on one transcript leave one tail, not two`() async {
        let watch = Self.watch()
        let (first, backfill) = hubLiveObservation(id: "one")
        await watch.startTailing(first)
        backfill.yield([.message(markdown: "backfill")])
        await settle { watch.sessions.first?.events.isEmpty == false }

        let (viaA, spokenToA) = hubLiveObservation(id: "one")
        let (viaB, spokenToB) = hubLiveObservation(id: "one")
        async let admitA: Void = watch.startTailing(viaA)
        async let admitB: Void = watch.startTailing(viaB)
        _ = await (admitA, admitB)

        // One of the two owns the transcript; the other must be reading nothing. Which one owns it
        // is not the claim — that only ONE of these ever reaches the reading is.
        spokenToA.yield([.message(markdown: "spoken once")])
        spokenToB.yield([.message(markdown: "spoken once")])
        let spoken = { watch.sessions.first.map(said(by:)) ?? [] }
        await settle { spoken().contains("spoken once") }

        #expect(spoken() == ["spoken once"])
    }

    /// What the guard above costs, asked of the file system rather than assumed. A superseded
    /// admit returns holding an observation nobody will ever drain — and an observation is not a
    /// promise to open a file, it has already opened one: a cursor and a watcher, two descriptors,
    /// taken when it was made (`TranscriptTail`). Letting it go out of scope is what gives them
    /// back, so this asserts the count rather than trusting the shape.
    @Test
    func `the admit that loses the race lets go of the file it opened`() async throws {
        let url = FileManager.default.temporaryDirectory
            .appending(path: "argo-watch-race-\(UUID().uuidString).jsonl")
        try #"{"type":"system"}"#.write(to: url, atomically: true, encoding: .utf8)
        defer { try? FileManager.default.removeItem(at: url) }
        let watch = Self.watch()

        // A tail already running, which is what puts the two admits below into the race: the
        // first of them waits for THIS one to end, and the second overtakes it there.
        try await watch.startTailing(watch.observe(url, reading: .excerpt))
        await settle { watch.sessions.count == 1 }

        // Handed over rather than held: an observation a TEST keeps alive is a file nothing can
        // give back, and the claim here is about what the watch lets go of.
        async let admitA: Void = try watch.startTailing(watch.observe(url, reading: .excerpt))
        async let admitB: Void = try watch.startTailing(watch.observe(url, reading: .excerpt))
        _ = try await (admitA, admitB)
        await settle { openDescriptorCount(for: url) <= 2 }

        // Two: the one live tail's cursor and its watcher. Four would be the loser still holding
        // the file it opened, which is the leak the early return could have made.
        #expect(openDescriptorCount(for: url) == 2)
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
            readings: SubagentReadings(),
        )
    }
}

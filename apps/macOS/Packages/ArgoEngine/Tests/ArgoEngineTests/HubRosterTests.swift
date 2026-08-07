@testable import ArgoEngine
import Foundation
import Testing

/// What the roster publishes, and when. The Hub reconstructs a Session by reading a file from its
/// first byte; these are the assertions that the reconstruction is not what the reader watches.
@Suite("Hub roster")
struct HubRosterTests {
    private static let projectURL = URL(fileURLWithPath: "/tmp/argo-roster")

    @Test
    @MainActor
    func `a transcript stays out of the roster until its file has been read`() async {
        let hub = Hub(projectURL: Self.projectURL)
        let (observation, continuation) = hubLiveObservation(id: "session")

        await hub.startObserving(observation)
        // Tailed, but nothing read yet — and the row it would draw here is titled with the file's
        // own UUID and knows no model, which is the rename-and-fill-in the reader used to see.
        #expect(hub.sessions.isEmpty)

        continuation.yield([.title("Read whole"), .model("claude-opus-5")])
        continuation.finish()
        await hubTailEnded(hub, transcriptID: "session")

        #expect(hub.sessions.map(\.title) == ["Read whole"])
        #expect(hub.sessions.map(\.model) == ["claude-opus-5"])
    }

    /// The row-count half of the same flicker: a continuation read before its root would stand as a
    /// Session of its own for as long as the root took to read, and then vanish into it.
    @Test
    @MainActor
    func `a continuation read first never stands as a Session of its own`() async {
        let hub = Hub(projectURL: Self.projectURL)
        let (root, rootEvents) = hubLiveObservation(id: "root")
        let (child, childEvents) = hubLiveObservation(id: "child")
        await hub.startObserving(root)
        await hub.startObserving(child)

        childEvents.yield([.headLeaf(uuid: "root-leaf"), .cwd("/tmp/worktree")])
        childEvents.finish()
        await hubTailEnded(hub, transcriptID: "child")
        #expect(hub.sessions.isEmpty)

        rootEvents.yield([.recordIdentity(uuid: "root-leaf"), .title("The whole session")])
        rootEvents.finish()
        await hubTailEnded(hub, transcriptID: "root")

        #expect(hub.sessions.map(\.id) == ["root"])
        #expect(hub.sessions[0].cwd == "/tmp/worktree")
    }

    /// A tail that can say nothing — an unopenable file, or one stopped mid-read — must not
    /// hold the roster back for the Sessions that CAN be read.
    @Test
    @MainActor
    func `a tail that ends without reading does not hold the roster back`() async {
        let hub = Hub(projectURL: Self.projectURL)
        let (silent, silentEvents) = hubLiveObservation(id: "silent")
        let spoken = hubTestObservation(id: "spoken", events: [.title("Spoken")])

        await hub.startObserving(silent)
        silentEvents.finish()
        await hubTailEnded(hub, transcriptID: "silent")
        await hubObserveToEnd(hub, spoken)

        #expect(hub.sessions.count == 2)
        #expect(hub.sessions.contains { $0.title == "Spoken" })
    }

    @Test
    @MainActor
    func `the roster is ordered by last activity, newest first`() async {
        let hub = Hub(projectURL: Self.projectURL)
        let older = hubTestObservation(id: "older", events: [.prompt(text: "Older", atMs: 1000)])
        let newer = hubTestObservation(id: "newer", events: [.prompt(text: "Newer", atMs: 9000)])

        // Observed oldest-first, so the answer cannot be the order the tails started in.
        await hubObserveToEnd(hub, older)
        await hubObserveToEnd(hub, newer)

        #expect(hub.sessions.map(\.id) == ["newer", "older"])
    }

    @Test
    @MainActor
    func `a Session whose records carry no time is ordered by the file's last write`() async {
        let hub = Hub(projectURL: Self.projectURL)
        let stale = hubTestObservation(
            id: "stale",
            events: [.title("Stale")],
            modifiedAt: Date(timeIntervalSince1970: 10),
        )
        let fresh = hubTestObservation(
            id: "fresh",
            events: [.title("Fresh")],
            modifiedAt: Date(timeIntervalSince1970: 20),
        )

        await hubObserveToEnd(hub, stale)
        await hubObserveToEnd(hub, fresh)

        #expect(hub.sessions.map(\.id) == ["fresh", "stale"])
    }

    /// The Project-switch cost: coming back to a Project draws what it already built, rather
    /// than an empty roster in front of a re-parse of every transcript it holds.
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `returning to a Project draws its roster before anything is re-read`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let mine = URL(fileURLWithPath: fixture.path("mine"))
        let theirs = URL(fileURLWithPath: fixture.path("theirs"))
        try fixture.write(FixtureTranscript(name: "mine", cwd: mine.path))
        try fixture.write(FixtureTranscript(
            directory: "other",
            name: "theirs",
            cwd: theirs.path,
        ))
        let hub = Hub(projectURL: mine, discovery: SessionDiscovery(store: fixture.store))

        await hub.connect(to: Self.pointing(at: mine))
        await hubSettle { !hub.sessions.isEmpty }
        let built = hub.sessions
        await hub.connect(to: Self.pointing(at: theirs))
        await hub.connect(to: Self.pointing(at: mine))

        // Asserted with no settling at all: the roster is standing when `connect` returns.
        #expect(hub.sessions == built)
        await hub.disconnect()
    }

    private static func pointing(at projectURL: URL) -> LaunchConfiguration {
        LaunchConfiguration(projectURL: projectURL, transcriptURLs: [])
    }
}

@testable import ArgoEngine
import Foundation
import Testing

/// What the Hub says about the Project it is pointed at, which is read off the tails rather than
/// set beside them. The three answers it has to keep apart: reading something, reading nothing, and
/// not finished pointing yet.
@Suite("Hub connection")
struct HubConnectionTests {
    private static let projectURL = URL(fileURLWithPath: "/tmp/argo-connection")

    /// "Connected" over an empty working set claims a source that is not there.
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `a Project with no live tail does not read as connected`() async throws {
        let hub = testHub(projectURL: Self.projectURL)

        try await hub.connect(to: LaunchConfiguration(
            projectURL: Self.projectURL,
            transcriptURLs: [hubFixtureURL("prose")],
        ))
        #expect(hub.connection == .connected)

        await hub.pauseObserving(transcriptID: hub.observations[0].id)

        #expect(hub.connection == .idle)
        #expect(hub.observations.map(\.state) == [.stopped])
        await hub.disconnect()
    }

    /// The window inside `connect`: the previous Project is already dropped and the new one has
    /// nothing standing. `connect` suspends on the checkout read, so a view does render here — and
    /// "No live sessions" would be an answer about a Project that has not been read yet.
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `a connect in flight reads as connecting, never as no sources`() async throws {
        let hub = testHub(projectURL: Self.projectURL)
        let named = try hubFixtureURL("prose")

        // The watcher goes first and is given its turn, so what is being tested is whether the
        // window exists — not whether a poll started after `connect` happens to catch it.
        let watcher = Task { await settle { hub.connection == .connecting } }
        await Task.yield()

        await hub.connect(to: LaunchConfiguration(
            projectURL: Self.projectURL,
            transcriptURLs: [named],
        ))

        #expect(await watcher.value)
        #expect(hub.connection == .connected)
        await hub.disconnect()
    }

    /// A failed connection is a claim about what could not be read, so a tail that then reads
    /// something answers it. Left standing, the chip would offer a retry over a live roster.
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `a tail that starts after a failure clears it`() async {
        let hub = testHub(projectURL: Self.projectURL)
        await hub.connect(to: LaunchConfiguration(
            projectURL: Self.projectURL,
            transcriptURLs: [FileManager.default.temporaryDirectory.appending(path: "absent")],
        ))
        #expect(hub.connection == .failed(message: "Transcript unavailable"))

        await hub.startObserving(hubTestObservation(id: "later", events: [.title("Later")]))

        #expect(hub.connection == .connected)
        await hub.disconnect()
    }

    /// A retry re-points at what the Hub is already on. It holds that configuration, so nothing is
    /// rebuilt on the way — a caller reassembling it could reassemble a different one.
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `a retry re-points at the configuration the Hub is already on`() async throws {
        let hub = testHub(projectURL: Self.projectURL)
        let named = try hubFixtureURL("prose")
        await hub.connect(to: LaunchConfiguration(
            projectURL: Self.projectURL,
            transcriptURLs: [named],
        ))

        await hub.reconnect()

        #expect(hub.project.url == Self.projectURL)
        await hubSettle { !hub.sessions.isEmpty }
        #expect(hub.sessions.map(\.sourceURL) == [named.standardizedFileURL])
        #expect(hub.connection == .connected)
        await hub.disconnect()
    }
}

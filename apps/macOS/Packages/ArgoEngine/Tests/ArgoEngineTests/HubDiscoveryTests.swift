@testable import ArgoEngine
import Foundation
import Testing

/// The Hub pointed at a record directory rather than at a list of paths: what the sweep finds, and
/// what moves when it finds something different.
@Suite("Hub discovery")
struct HubDiscoveryTests {
    private static let wellOutsideTheWindow = SessionDiscovery.workingSetWindow * 2

    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `connecting with no named transcript tails what the sweep finds`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let projectURL = URL(fileURLWithPath: fixture.path("checkout"))
        let mine = try fixture.write(FixtureTranscript(name: "mine", cwd: projectURL.path))
        try fixture.write(FixtureTranscript(
            directory: "elsewhere",
            name: "theirs",
            cwd: fixture.path("other-checkout"),
        ))
        let hub = Hub(projectURL: projectURL, discovery: SessionDiscovery(store: fixture.store))

        await hub.connect(using: Engine(), configuration: LaunchConfiguration(
            projectURL: projectURL,
            transcriptURLs: [],
        ))

        #expect(hub.sessions.map(\.sourceURL) == [mine.standardizedFileURL])
        #expect(hub.connection == .healthy)
        await hub.disconnect()
    }

    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `a transcript recorded after the connect joins the roster`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let projectURL = URL(fileURLWithPath: fixture.path("checkout"))
        let hub = Hub(projectURL: projectURL, discovery: SessionDiscovery(store: fixture.store))
        await hub.connect(using: Engine(), configuration: LaunchConfiguration(
            projectURL: projectURL,
            transcriptURLs: [],
        ))
        #expect(hub.sessions.isEmpty)

        let started = try fixture.write(FixtureTranscript(name: "started", cwd: projectURL.path))
        await hub.refreshWorkingSet()

        #expect(hub.sessions.map(\.sourceURL) == [started.standardizedFileURL])
        #expect(hub.liveObservationCount == 1)
        await hub.disconnect()
    }

    /// The descriptors are the bounded resource, not the roster. A row disappearing under the user
    /// would be a claim that the Session never happened.
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `a transcript ageing out stops being tailed and keeps its row`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let projectURL = URL(fileURLWithPath: fixture.path("checkout"))
        let quiet = try fixture.write(FixtureTranscript(name: "quiet", cwd: projectURL.path))
        let hub = Hub(projectURL: projectURL, discovery: SessionDiscovery(store: fixture.store))
        await hub.connect(using: Engine(), configuration: LaunchConfiguration(
            projectURL: projectURL,
            transcriptURLs: [],
        ))
        #expect(hub.liveObservationCount == 1)

        try fixture.age(quiet, by: Self.wellOutsideTheWindow)
        await hub.refreshWorkingSet()

        #expect(hub.liveObservationCount == 0)
        #expect(hub.sessions.map(\.sourceURL) == [quiet.standardizedFileURL])
        await hub.disconnect()
    }

    /// `--transcript` is the render harness's explicit override. A named transcript means the
    /// caller has said what to read, so nothing is swept for and nothing else appears.
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `a named transcript suppresses the sweep`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let projectURL = URL(fileURLWithPath: fixture.path("checkout"))
        try fixture.write(FixtureTranscript(name: "discoverable", cwd: projectURL.path))
        let named = try hubFixtureURL("prose")
        let hub = Hub(projectURL: projectURL, discovery: SessionDiscovery(store: fixture.store))

        await hub.connect(using: Engine(), configuration: LaunchConfiguration(
            projectURL: projectURL,
            transcriptURLs: [named],
        ))

        #expect(hub.sessions.map(\.sourceURL) == [named.standardizedFileURL])
        await hub.disconnect()
    }
}

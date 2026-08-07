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
        let hub = testHub(projectURL: projectURL, discovery: SessionDiscovery(store: fixture.store))

        await hub.connect(to: LaunchConfiguration(
            projectURL: projectURL,
            transcriptURLs: [],
        ))

        await hubSettle { !hub.sessions.isEmpty }
        #expect(hub.sessions.map(\.sourceURL) == [mine.standardizedFileURL])
        #expect(hub.connection == .connected)
        await hub.disconnect()
    }

    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `a transcript recorded after the connect joins the roster`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let projectURL = URL(fileURLWithPath: fixture.path("checkout"))
        let hub = testHub(projectURL: projectURL, discovery: SessionDiscovery(store: fixture.store))
        await hub.connect(to: LaunchConfiguration(
            projectURL: projectURL,
            transcriptURLs: [],
        ))
        #expect(hub.sessions.isEmpty)

        let started = try fixture.write(FixtureTranscript(name: "started", cwd: projectURL.path))
        await hub.refreshWorkingSet()

        await hubSettle { !hub.sessions.isEmpty }
        #expect(hub.sessions.map(\.sourceURL) == [started.standardizedFileURL])
        #expect(hub.observations.map(\.state) == [.live])
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
        let hub = testHub(projectURL: projectURL, discovery: SessionDiscovery(store: fixture.store))
        await hub.connect(to: LaunchConfiguration(
            projectURL: projectURL,
            transcriptURLs: [],
        ))
        #expect(hub.observations.map(\.state) == [.live])

        try fixture.age(quiet, by: Self.wellOutsideTheWindow)
        await hub.refreshWorkingSet()

        #expect(hub.observations.map(\.state) == [.stopped])
        #expect(hub.sessions.map(\.sourceURL) == [quiet.standardizedFileURL])
        await hub.disconnect()
    }

    /// The join resolves a record's owner by which transcript claimed it first, so a transcript's
    /// PLACE in it is part of its identity. A pause that re-appended on resume would put a
    /// resume-chain root behind its own continuation and re-attribute the records it authored.
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `a paused transcript keeps its place when it is tailed again`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let projectURL = URL(fileURLWithPath: fixture.path("checkout"))
        let first = try fixture.write(FixtureTranscript(name: "first", cwd: projectURL.path))
        try fixture.write(
            FixtureTranscript(name: "second", cwd: projectURL.path, modifiedAgo: 600),
        )
        let hub = testHub(projectURL: projectURL, discovery: SessionDiscovery(store: fixture.store))
        await hub.connect(to: LaunchConfiguration(
            projectURL: projectURL,
            transcriptURLs: [],
        ))
        await hubSettle { hub.sessions.count == 2 }
        let order = hub.sessions.map(\.sourceURL)
        #expect(order.first == first.standardizedFileURL)

        try fixture.age(first, by: Self.wellOutsideTheWindow)
        await hub.refreshWorkingSet()
        try fixture.age(first, by: 0)
        await hub.refreshWorkingSet()

        #expect(hub.sessions.map(\.sourceURL) == order)
        #expect(hub.observations.map(\.state) == [.live, .live])
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
        let hub = testHub(projectURL: projectURL, discovery: SessionDiscovery(store: fixture.store))

        await hub.connect(to: LaunchConfiguration(
            projectURL: projectURL,
            transcriptURLs: [named],
        ))

        await hubSettle { !hub.sessions.isEmpty }
        #expect(hub.sessions.map(\.sourceURL) == [named.standardizedFileURL])
        await hub.disconnect()
    }
}

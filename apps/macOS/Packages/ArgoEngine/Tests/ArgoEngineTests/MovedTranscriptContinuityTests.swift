@testable import ArgoEngine
import Foundation
import Testing

@Suite("Moved transcript continuity")
struct MovedTranscriptContinuityTests {
    /// Selection reconciliation sees either the path it held or the row that retired that path.
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `a move never publishes its prior identity absent`() async throws {
        let context = try await connectedFixture(withNeighbor: true)
        defer { context.fixture.remove() }
        let fixture = context.fixture
        let projectURL = context.projectURL
        let started = context.started
        let hub = context.hub
        var publications: [[HubSession]] = []
        hub.watch.onPublished = { publications.append(hub.sessions) }
        try await Task.sleep(for: .seconds(TranscriptWatch.publishWindow))

        let moved = try fixture.write(FixtureTranscript(
            directory: "worktree-project", name: "moved", cwd: projectURL.path,
        ))
        try FileManager.default.removeItem(at: started)
        await hub.refreshWorkingSet()
        await hubSettle { hub.sessions.contains { $0.sourceURL == moved.standardizedFileURL } }

        #expect(!publications.isEmpty)
        #expect(publications.allSatisfy { sessions in
            sessions.contains {
                $0.id == started.standardizedFileURL.path
                    || $0.absorbedIDs.contains(started.standardizedFileURL.path)
            }
        })
        await hub.disconnect()
    }

    /// A full reading remains full under the new path and after the moved tail is reopened.
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `a moved whole reading reopens whole`() async throws {
        let context = try await connectedFixture()
        defer { context.fixture.remove() }
        let fixture = context.fixture
        let projectURL = context.projectURL
        let started = context.started
        let hub = context.hub
        await hub.watch.readWhole(rowID: started.standardizedFileURL.path)

        let moved = try fixture.write(FixtureTranscript(
            directory: "worktree-project", name: "moved", cwd: projectURL.path,
        ))
        try FileManager.default.removeItem(at: started)
        await hub.refreshWorkingSet()
        await hubSettle { hub.sessions.contains { $0.sourceURL == moved.standardizedFileURL } }
        let wholeReads = hub.watch.reads.whole
        await hub.watch.pauseObserving(transcriptID: moved.standardizedFileURL.path)
        await hub.watch.move(onto: [moved])
        await hubSettle { hub.watch.isObserving(transcriptID: moved.standardizedFileURL.path) }

        #expect(hub.watch.isReadWhole(transcriptID: moved.standardizedFileURL.path))
        #expect(hub.watch.reads.whole == wholeReads + 1)
        await hub.disconnect()
    }

    /// Discovery can see the new path just before its open fails. That race waits with the old row
    /// standing instead of briefly selecting its neighbour.
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `an unavailable move destination retains its row`() async throws {
        let context = try await connectedFixture()
        defer { context.fixture.remove() }
        let fixture = context.fixture
        let started = context.started
        let hub = context.hub
        var publications = [hub.sessions]
        hub.watch.onPublished = { publications.append(hub.sessions) }

        let destination = fixture.rootURL
            .appending(path: "worktree-project", directoryHint: .isDirectory)
            .appending(path: "moved.jsonl")
        try FileManager.default.removeItem(at: started)
        await hub.watch.move(onto: [destination])

        #expect(publications.allSatisfy { sessions in
            sessions.contains { $0.id == started.standardizedFileURL.path }
        })
        await hub.disconnect()
    }

    @MainActor
    private func connectedFixture(
        withNeighbor: Bool = false,
    ) async throws
        -> MoveFixture {
        let fixture = try RecordDirectoryFixture()
        let projectURL = URL(fileURLWithPath: fixture.path("checkout"))
        let started = try fixture.write(FixtureTranscript(name: "moved", cwd: projectURL.path))
        if withNeighbor {
            _ = try fixture.write(FixtureTranscript(name: "neighbor", cwd: projectURL.path))
        }
        let hub = testHub(projectURL: projectURL, discovery: SessionDiscovery(store: fixture.store))
        await hub.connect(to: LaunchConfiguration(projectURL: projectURL, transcriptURLs: []))
        await hubSettle { hub.sessions.count == (withNeighbor ? 2 : 1) }
        return MoveFixture(fixture: fixture, projectURL: projectURL, started: started, hub: hub)
    }
}

@MainActor
private struct MoveFixture {
    let fixture: RecordDirectoryFixture
    let projectURL: URL
    let started: URL
    let hub: Hub
}

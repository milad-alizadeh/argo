@testable import ArgoEngine
import Foundation
import Testing

/// The relocation as the SWEEP delivers it, rather than as a hand-made observation: the transcript
/// really moves on disk, and the working set is re-read the way the record directory's own watcher
/// re-reads it (#1406).
///
/// `SpawnRelocationTests` drives `startObserving` directly, so it asserts what the claim does with
/// two paths it is HANDED. This asserts the step before that — that the moved path reaches the
/// claim at all — which is where a Session Argo spawned lost its claim and rendered read-only.
@Suite("Spawn relocation through the sweep")
@MainActor
struct SpawnRelocationSweepTests {
    @Test(.timeLimit(.minutes(1)))
    func `a spawned Session stays Argo's own when the sweep finds its transcript moved`()
        async throws {
        let records = try RecordDirectoryFixture()
        defer { records.remove() }
        let fixture = try SpawnFixture(discovery: SessionDiscovery(store: records.store))
        defer { fixture.remove() }
        _ = try await fixture.hub.spawnSession()
        let started = try records.write(Self.transcript(in: "project", of: fixture))
        await fixture.hub.connect(
            to: LaunchConfiguration(projectURL: fixture.projectURL, transcriptURLs: []),
        )
        await hubSettle { fixture.hub.sessions.contains { $0.id == started.path } }

        let moved = try records.write(Self.transcript(in: "worktree-project", of: fixture))
        try FileManager.default.removeItem(at: started)
        await fixture.hub.refreshWorkingSet()

        await hubSettle { fixture.hub.sessions.map(\.id) == [moved.standardizedFileURL.path] }
        #expect(fixture.hub.sessions.map(\.provenance) == [.managed])
        await fixture.hub.disconnect()
    }

    /// The sweep that catches the move MID-FLIGHT: the CLI has written the new file and not yet
    /// unlinked the old, so one sweep sees both paths and the claim's own path is still in the
    /// working set when the new tail's batch lands (#1406).
    @Test(.timeLimit(.minutes(1)))
    func `a spawned Session stays Argo's own when one sweep catches both paths`() async throws {
        let records = try RecordDirectoryFixture()
        defer { records.remove() }
        let fixture = try SpawnFixture(discovery: SessionDiscovery(store: records.store))
        defer { fixture.remove() }
        _ = try await fixture.hub.spawnSession()
        let started = try records.write(Self.transcript(in: "project", of: fixture))
        await fixture.hub.connect(
            to: LaunchConfiguration(projectURL: fixture.projectURL, transcriptURLs: []),
        )
        await hubSettle { fixture.hub.sessions.contains { $0.id == started.path } }

        let moved = try records.write(Self.transcript(in: "worktree-project", of: fixture))
        // The two halves are ONE file, so they last ran at the same moment. That tie is what
        // leaves the row reading the abandoned path — and a row under the path the claim already
        // holds is one reconciliation has nothing to do with.
        try records.matchModificationTime(of: moved, to: started)
        await fixture.hub.refreshWorkingSet()
        await hubSettle {
            fixture.hub.watch.join.transcripts.contains { $0.id == moved.path && $0.isSettled }
        }
        try FileManager.default.removeItem(at: started)
        await fixture.hub.refreshWorkingSet()

        await hubSettle { fixture.hub.sessions.map(\.id) == [moved.standardizedFileURL.path] }
        #expect(fixture.hub.sessions.map(\.provenance) == [.managed])
        // And written down under the path the row now carries, which is what a relaunch reads to
        // tell this Session from one Argo never started (ADR-0026).
        #expect(fixture.hub.ownership.hasEverOwned(sessionID: moved.path))
        await fixture.hub.disconnect()
    }

    /// The transcript the spawn was told to write, under one record directory or another. Its
    /// `cwd` is the Project's own either way: the CLI records where it was LAUNCHED, and a move
    /// into a worktree's record directory does not rewrite the head it already wrote.
    private static func transcript(
        in directory: String,
        of fixture: SpawnFixture,
    )
        -> FixtureTranscript {
        FixtureTranscript(
            directory: directory,
            name: spawnedChainID,
            cwd: fixture.projectURL.path,
        )
    }
}

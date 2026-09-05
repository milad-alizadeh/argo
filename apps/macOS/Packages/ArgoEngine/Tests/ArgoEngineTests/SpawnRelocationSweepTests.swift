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
    /// The ordinary move, where the file is gone by the time the sweep runs: the moved path is
    /// admitted as a fresh tail, and the batch that tail lands carries it to the claim. Green
    /// before #1406 as well — it is the floor the case below is measured against, not the guard.
    @Test(.timeLimit(.minutes(1)))
    func `a spawned Session stays Argo's own when the sweep finds its transcript moved`()
        async throws {
        let spawned = try await Spawned()
        defer { spawned.remove() }

        let moved = try spawned.write(in: "worktree-project")
        try FileManager.default.removeItem(at: spawned.started)
        await spawned.hub.refreshWorkingSet()

        await spawned.expectStillOwned(at: moved)
    }

    /// The sweep that catches the move MID-FLIGHT: the CLI has written the new file and not yet
    /// unlinked the old, so one sweep sees both paths and the claim's own path is still in the
    /// working set when the new tail's batch lands (#1406).
    @Test(.timeLimit(.minutes(1)))
    func `a spawned Session stays Argo's own when one sweep catches both paths`() async throws {
        let spawned = try await Spawned()
        defer { spawned.remove() }

        let moved = try spawned.write(in: "worktree-project")
        // The two halves are ONE file, so they last ran at the same moment. That tie is what
        // leaves the row reading the abandoned path — and a row under the path the claim already
        // holds is one reconciliation has nothing to do with.
        try spawned.records.matchModificationTime(of: moved, to: spawned.started)
        await spawned.hub.refreshWorkingSet()
        await hubSettle {
            spawned.hub.watch.join.transcripts.contains { $0.id == moved.path && $0.isSettled }
        }
        try FileManager.default.removeItem(at: spawned.started)
        await spawned.hub.refreshWorkingSet()

        await spawned.expectStillOwned(at: moved)
    }

    /// The state #1406 was REPORTED in: the ledger holds a window under the path the transcript
    /// left, the process that claimed it is gone, and only the file crosses that gap.
    ///
    /// `orphaned` and not `managed` is the whole of ADR-0026 — the PTY died with the Argo that
    /// owned it, and no relaunch can re-adopt one. What the ticket asks for is that this Session
    /// stop reading `external`, which claims Argo never started it and offers no way back.
    @Test(.timeLimit(.minutes(1)))
    func `a Session whose transcript moved before the last quit is orphaned, never external`()
        async throws {
        let spawned = try await Spawned()
        defer { spawned.remove() }
        let moved = try spawned.write(in: "worktree-project")
        try FileManager.default.removeItem(at: spawned.started)
        await spawned.hub.disconnect()

        let restarted = spawned.fixture.restarted()
        await restarted.connect(
            to: LaunchConfiguration(
                projectURL: spawned.fixture.projectURL,
                transcriptURLs: [],
            ),
        )

        await hubSettle { restarted.sessions.map(\.id) == [moved.standardizedFileURL.path] }
        #expect(restarted.sessions.map(\.provenance) == [.orphaned])
        // And everything the window carried comes with it: a relaunch that lost the link would
        // fall back to the branch guess (#894).
        #expect(restarted.ownership.spawnTicket(ofSessionID: moved.path) == Spawned.ticket)
        await restarted.disconnect()
    }

    /// A Session Argo spawned, its transcript written where the CLI first wrote it, and the Hub
    /// connected and reading it. Where both tests start, so each one shows only its own move.
    @MainActor
    private struct Spawned {
        let records: RecordDirectoryFixture
        let fixture: SpawnFixture
        /// The transcript under the Project's own record directory — the path the claim holds
        /// until the file moves.
        let started: URL

        var hub: Hub {
            fixture.hub
        }

        /// The Ticket the spawn is told it is for, so the ledger has a fact to carry across the
        /// restart besides the window itself.
        static let ticket = 1406

        init() async throws {
            self.records = try RecordDirectoryFixture()
            self.fixture = try SpawnFixture(store: records.store)
            _ = try await fixture.hub.spawnSession(seed: SessionSeed(ticket: Self.ticket))
            self.started = try Self.write(in: "project", of: records, for: fixture)
            await fixture.hub.connect(
                to: LaunchConfiguration(projectURL: fixture.projectURL, transcriptURLs: []),
            )
            let path = started.path
            let hub = fixture.hub
            await hubSettle { hub.sessions.contains { $0.id == path } }
        }

        /// The same transcript under another record directory, which is what the move leaves.
        func write(in directory: String) throws -> URL {
            try Self.write(in: directory, of: records, for: fixture)
        }

        /// The whole reading this suite is for: the row is the moved path, the claim still holds
        /// it, and the ledger says so under that path — which is what a relaunch reads to tell
        /// this Session from one Argo never started (ADR-0026).
        func expectStillOwned(at moved: URL, at location: SourceLocation = #_sourceLocation) async {
            let path = moved.standardizedFileURL.path
            let hub = fixture.hub
            await hubSettle(until: { hub.sessions.map(\.id) == [path] }, at: location)
            #expect(hub.sessions.map(\.provenance) == [.managed], sourceLocation: location)
            #expect(hub.ownership.hasEverOwned(sessionID: moved.path), sourceLocation: location)
            await hub.disconnect()
        }

        func remove() {
            fixture.remove()
            records.remove()
        }

        /// The transcript the spawn was told to write. Its `cwd` is the Project's own under either
        /// record directory: the CLI records where it was LAUNCHED, and a move into a worktree's
        /// record directory does not rewrite the head it already wrote.
        private static func write(
            in directory: String,
            of records: RecordDirectoryFixture,
            for fixture: SpawnFixture,
        ) throws
            -> URL {
            try records.write(FixtureTranscript(
                directory: directory,
                name: spawnedChainID,
                cwd: fixture.projectURL.path,
            ))
        }
    }
}

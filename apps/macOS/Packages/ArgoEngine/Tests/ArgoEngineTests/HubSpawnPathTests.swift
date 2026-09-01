@testable import ArgoEngine
import Foundation
import Synchronization
import Testing

/// A spawned Session's own folder, spelled at the spawn (#959).
///
/// A spawn is in no transcript and in no sweep: it is a provisional row the Hub publishes before
/// any record exists. So it is the one folder that joins the roster with nothing else to spell it,
/// and without the call at the spawn its row would match no process for up to
/// `WorldReadings.interval`. Every fixture here sits under `NSTemporaryDirectory`, which is a
/// symlink on any Mac, so an unspelled folder matches nothing at all.
@Suite("Hub spawn paths")
@MainActor
struct HubSpawnPathTests {
    @Test
    func `a spawned row matches its own process without waiting for a sweep`() async throws {
        let processes = SpawnedProcesses()
        let fixture = try SpawnFixture(liveness: { processes.cwds })
        defer { fixture.remove() }
        processes.cwds = [fixture.resolvedProjectPath]
        // A poll taken before the spawn exists: it establishes the clock liveness is judged against
        // and finds the process, and it spells nothing, because the roster is still empty.
        await fixture.hub.refreshLiveness()

        _ = try await fixture.hub.spawnSession()

        #expect(fixture.hub.sessions.map(\.liveness) == [.live])
    }
}

/// #363: the folder is reached through a symlink, so the Project's own root and the folder the
/// row carries are two spellings of one directory. The row is still in the roster the Hub publishes
/// for that Project — an agent Argo owns and does not draw is the worst of both tiers.
@Suite("Hub spawn symlinked folders")
@MainActor
struct HubSpawnSymlinkTests {
    @Test
    func `a spawn in a folder reached through a symlink is in the Project's roster`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let worktree = fixture.projectURL.appending(path: "worktree", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: worktree, withIntermediateDirectories: true)
        let link = fixture.projectURL.appending(path: "link", directoryHint: .isDirectory)
        try FileManager.default.createSymbolicLink(at: link, withDestinationURL: worktree)

        let claim = try await fixture.hub.spawnSession(seed: SessionSeed(cwd: link.path))

        #expect(fixture.hub.sessions.map(\.id) == [claim.value])
        #expect(fixture.hub.sessions.map(\.provenance) == [.managed])
    }
}

/// The process table for one case, settable after the fixture has picked its folders. Behind a
/// `Mutex` because the read runs off the main actor.
private final class SpawnedProcesses: Sendable {
    private let running = Mutex<Set<String>>([])

    var cwds: Set<String> {
        get { running.withLock { $0 } }
        set { running.withLock { $0 = newValue } }
    }
}

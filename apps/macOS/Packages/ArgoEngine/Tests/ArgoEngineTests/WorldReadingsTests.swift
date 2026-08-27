@testable import ArgoEngine
import Foundation
import Testing

/// The world outside the transcripts, driven directly rather than through a Hub: what the process
/// table and git said about a Session's folder, and what the readings answer before either has been
/// read.
@Suite("World readings")
@MainActor
struct WorldReadingsTests {
    private static let cwd = "/tmp/argo-world"

    @Test
    func `a folder the process table names is running an agent`() async {
        let readings = Self.readings(runningIn: [Self.cwd])

        await readings.refreshLiveness()

        #expect(readings.liveness(inCwd: Self.cwd, lastActivityAtMs: Self.nowMs) == .live)
    }

    @Test
    func `a folder nobody is running in is quiet`() async {
        let readings = Self.readings(runningIn: ["/tmp/argo-elsewhere"])

        await readings.refreshLiveness()

        #expect(readings.liveness(inCwd: Self.cwd, lastActivityAtMs: Self.nowMs) == .quiet)
    }

    /// `lsof` answers with the symlinks already followed and a transcript reports the path its
    /// agent was launched with. Compared as written, the match would never fire.
    @Test
    func `a folder reached through a symlink is the same folder`() async throws {
        let folder = "/tmp/argo-world-\(UUID().uuidString)"
        try FileManager.default.createDirectory(atPath: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(atPath: folder) }
        #expect(resolvedPath(folder) != folder)
        let readings = Self.readings(runningIn: [resolvedPath(folder)])

        await readings.refreshLiveness()

        #expect(readings.liveness(inCwd: folder, lastActivityAtMs: Self.nowMs) == .live)
    }

    /// Before the first poll there is no clock to judge recency against, so a Session mid-turn
    /// still reads quiet — the degrade-down rule, at the one place it can fire.
    @Test
    func `an unread world says nothing about a Session mid-turn`() {
        let readings = Self.readings(runningIn: [Self.cwd])

        #expect(readings.liveness(inCwd: Self.cwd, lastActivityAtMs: Self.nowMs) == .quiet)
        #expect(readings.workspace(inCwd: Self.cwd) == nil)
    }

    @Test
    func `a Workspace is keyed by the folder it was read for`() async {
        let readings = Self.readings(cwds: [Self.cwd, "/tmp/argo-other"])

        await readings.refreshWorkspaces()

        #expect(readings.workspace(inCwd: Self.cwd)?.branch == "argo-world")
        #expect(readings.workspace(inCwd: "/tmp/argo-other")?.branch == "argo-other")
        #expect(readings.workspace(inCwd: "/tmp/argo-unread") == nil)
    }

    /// One subprocess run per DISTINCT folder: four Sessions in one checkout must not cost four.
    @Test
    func `git is asked once per distinct folder, however many Sessions share it`() async {
        let asked = ReadCounter()
        let readings = Self.readings(
            cwds: [Self.cwd, Self.cwd, "/tmp/argo-other"],
            workspace: { _ in await asked.record() },
        )

        await readings.refreshWorkspaces()

        #expect(await asked.count == 2)
    }

    @Test
    func `a folder git cannot answer for keeps no entry at all`() async {
        let readings = Self.readings(cwds: [Self.cwd], workspace: { _ in nil })

        await readings.refreshWorkspaces()

        // An unread Workspace is not a clean one, and neither is an unanswerable folder.
        #expect(readings.workspace(inCwd: Self.cwd) == nil)
    }

    @Test
    func `stopping drops everything the readings knew about the machine`() async {
        let readings = Self.readings(runningIn: [Self.cwd], cwds: [Self.cwd])
        await readings.refreshLiveness()
        await readings.refreshWorkspaces()
        #expect(readings.liveness(inCwd: Self.cwd, lastActivityAtMs: Self.nowMs) == .live)
        #expect(readings.workspace(inCwd: Self.cwd) != nil)

        await readings.stop()

        #expect(readings.liveness(inCwd: Self.cwd, lastActivityAtMs: Self.nowMs) == .quiet)
        #expect(readings.workspace(inCwd: Self.cwd) == nil)
    }

    private static var nowMs: Int {
        Date().epochMs
    }

    /// Readings over a machine running an agent in each folder named, asked about the folders in
    /// `cwds`. Every case above differs only in what those two reads were found to say.
    private static func readings(
        runningIn live: Set<String> = [],
        cwds: [String] = [],
        workspace: @escaping WorkspaceRead = branchNamedAfterFolder,
    )
        -> WorldReadings {
        WorldReadings(
            engine: Engine(
                readCheckout: CheckoutFixture().read,
                readWorkspace: workspace,
                readLiveness: { live },
            ),
            sessionCwds: { cwds },
        )
    }
}

/// What git would say about a folder, named after it — so a test can tell which read answered
/// which entry. Outside the suite because the read is handed to an `Engine` and runs off the main
/// actor.
private let branchNamedAfterFolder: WorkspaceRead = { url in
    WorkspaceProjection(kind: .worktree, branch: url.lastPathComponent, dirty: 0, unpushed: 0)
}

/// How many times git was asked, for the one case that is about the count rather than the answer.
private actor ReadCounter {
    private(set) var count = 0

    func record() -> WorkspaceProjection? {
        count += 1
        return nil
    }
}

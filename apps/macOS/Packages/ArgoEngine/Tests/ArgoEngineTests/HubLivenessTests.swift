@testable import ArgoEngine
import Foundation
import Testing

/// What the roster reads once the process table is folded into it — the half of a Session's status
/// that no transcript carries.
@Suite("Hub liveness")
@MainActor
struct HubLivenessTests {
    private static let cwd = "/tmp/argo-live"
    private static var nowMs: Int {
        Date().epochMs
    }

    /// A Hub whose machine is running an agent in each of the folders named, with the read already
    /// taken — so every case below differs only in what the process table was found to say.
    private static func hub(runningIn cwds: String...) async -> Hub {
        let hub = testHub(
            projectURL: URL(fileURLWithPath: cwd),
            liveness: { Set(cwds) },
        )
        await hub.refreshLiveness()
        return hub
    }

    /// A Session mid-turn, writing as of now — so the only thing left to decide its status is
    /// whether a process is behind it.
    private static func working(id: String) -> TranscriptObservation {
        hubTestObservation(id: id, events: [
            .cwd(cwd),
            .prompt(text: "Refactor it", atMs: nowMs),
        ])
    }

    @Test
    func `a matched process behind an open turn reads running`() async {
        let hub = await Self.hub(runningIn: Self.cwd)

        await hubObserveToEnd(hub, Self.working(id: "live"))

        #expect(hub.sessions.first?.liveness == .live)
        #expect(hub.sessions.first?.status == .running)
    }

    @Test
    func `the same open turn with no process behind it never reads running`() async {
        let hub = await Self.hub()

        await hubObserveToEnd(hub, Self.working(id: "gone"))

        // The degrade-down rule at the only place it can fire: a transcript whose writer died
        // mid-turn is quiet, not working.
        #expect(hub.sessions.first?.status == .idle)
    }

    @Test
    func `an agent running somewhere else is not this Session's`() async {
        let hub = await Self.hub(runningIn: "/tmp/argo-elsewhere")

        await hubObserveToEnd(hub, Self.working(id: "elsewhere"))

        #expect(hub.sessions.first?.status == .idle)
    }

    @Test
    func `a folder reached through a symlink is the same folder`() async throws {
        // A folder that really exists under `/tmp`, which on this platform is a symlink: `lsof`
        // answers with `/private/tmp/…` while the transcript reports what the agent was launched
        // with. Compared as written, the match would never fire.
        let folder = "/tmp/argo-liveness-\(UUID().uuidString)"
        try FileManager.default.createDirectory(
            atPath: folder,
            withIntermediateDirectories: true,
        )
        defer { try? FileManager.default.removeItem(atPath: folder) }
        #expect(resolvedPath(folder) != folder)
        let hub = await Self.hub(runningIn: resolvedPath(folder))

        await hubObserveToEnd(hub, hubTestObservation(id: "symlinked", events: [
            .cwd(folder),
            .prompt(text: "Refactor it", atMs: Self.nowMs),
        ]))

        #expect(hub.sessions.first?.status == .running)
    }

    @Test
    func `a Session whose last write has gone stale stops reading live`() async {
        let hub = await Self.hub(runningIn: Self.cwd)
        let stale = Self.nowMs - SessionLiveness.recentActivityWindowMs - 1000
        let quiet = hubTestObservation(id: "stale", events: [
            .cwd(Self.cwd),
            .prompt(text: "Refactor it", atMs: stale),
        ])

        await hubObserveToEnd(hub, quiet)

        #expect(hub.sessions.first?.liveness == .quiet)
    }

    @Test
    func `a transcript that timestamps nothing is read by its own last write`() async {
        let hub = await Self.hub(runningIn: Self.cwd)
        // Not one record carries a time, so mtime is the only thing left to corroborate a match.
        let untimed = hubTestObservation(
            id: "untimed",
            events: [.cwd(Self.cwd), .prompt(text: "Refactor it", atMs: nil)],
            modifiedAt: Date(),
        )

        await hubObserveToEnd(hub, untimed)

        #expect(hub.sessions.first?.status == .running)
    }

    @Test
    func `the roster reads its posture off the ownership registry, not off a literal`() async {
        let hub = await Self.hub()
        let claim = hub.ownership.claim(cwd: Self.cwd)

        await hubObserveToEnd(hub, Self.working(id: "ours"))
        #expect(hub.sessions.first?.provenance == .managed)

        // And the same Session demotes the moment the PTY it was claimed with is gone.
        hub.ownership.release(claim)
        #expect(hub.sessions.first?.provenance == .orphaned)
    }

    @Test
    func `a Session Argo owns and can no longer see has ended`() async {
        let hub = await Self.hub()
        let claim = hub.ownership.claim(cwd: Self.cwd)
        await hubObserveToEnd(hub, hubTestObservation(id: "ended", events: [
            .cwd(Self.cwd),
            .prompt(text: "Refactor it", atMs: Self.nowMs),
            .turnEnded(.endTurn),
        ]))
        hub.ownership.release(claim)

        // The one exit Argo witnesses is its own PTY dying, which is what `orphaned` records.
        #expect(hub.sessions.first?.status == .ended)
    }

    @Test
    func `dropping a Project drops what it knew about the machine's processes`() async {
        let hub = await Self.hub(runningIn: Self.cwd)
        #expect(!hub.liveCwds.isEmpty)

        await hub.disconnect()

        #expect(hub.liveCwds.isEmpty)
        #expect(hub.livenessReadAtMs == nil)
    }
}

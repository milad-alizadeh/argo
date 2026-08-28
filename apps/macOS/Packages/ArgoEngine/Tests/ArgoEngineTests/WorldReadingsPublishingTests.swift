@testable import ArgoEngine
import Foundation
import Synchronization
import Testing

/// What a world poll is allowed to publish (#858). Its properties are observed, so a write
/// invalidates every view that draws a Session — and the poll wrote on a five-second beat whether
/// or not anything had moved, which is the cockpit's idle heartbeat.
///
/// Every case here reads the poll through the same door the roster does and watches whether the
/// read was invalidated, never whether a rule returned true.
@Suite("World readings publishing")
@MainActor
struct WorldReadingsPublishingTests {
    @Test
    func `a poll that found the same processes publishes nothing`() async {
        let machine = Machine()
        await machine.readings.refreshLiveness()
        let watcher = machine.watchingLiveness()

        await machine.readings.refreshLiveness()

        #expect(!watcher.fired)
    }

    @Test
    func `a sweep that found every worktree as it left it publishes nothing`() async {
        let machine = Machine()
        await machine.readings.refreshWorkspaces()
        let watcher = Tripwire.watching { _ = machine.readings.readWorkspaces }

        await machine.readings.refreshWorkspaces()

        #expect(!watcher.fired)
    }

    /// The stamp cannot simply be frozen: a Session matched by the process table but silent for
    /// longer than the recency window has to stop reading live, and only a newer clock says so.
    @Test
    func `a Session that fell out of the recency window is published`() async {
        let machine = Machine()
        await machine.readings.refreshLiveness(clock: { startedAtMs })
        #expect(machine.livenessOfTheAgent == .live)
        let watcher = machine.watchingLiveness()

        await machine.readings.refreshLiveness(
            clock: { startedAtMs + SessionLiveness.recentActivityWindowMs + 1 },
        )

        #expect(watcher.fired)
        #expect(machine.livenessOfTheAgent == .quiet)
    }

    @Test
    func `a clock that changes no answer publishes nothing`() async {
        let machine = Machine()
        await machine.readings.refreshLiveness(clock: { startedAtMs })
        let watcher = machine.watchingLiveness()

        await machine.readings.refreshLiveness(clock: { startedAtMs + 5000 })

        #expect(!watcher.fired)
    }

    @Test
    func `a process that appeared is published`() async {
        let machine = Machine(running: false)
        await machine.readings.refreshLiveness(clock: { startedAtMs })
        let watcher = machine.watchingLiveness()

        machine.running = true
        await machine.readings.refreshLiveness(clock: { startedAtMs })

        #expect(watcher.fired)
        #expect(machine.livenessOfTheAgent == .live)
    }

    @Test
    func `a process that went is published`() async {
        let machine = Machine()
        await machine.readings.refreshLiveness(clock: { startedAtMs })
        let watcher = machine.watchingLiveness()

        machine.running = false
        await machine.readings.refreshLiveness(clock: { startedAtMs })

        #expect(watcher.fired)
        #expect(machine.livenessOfTheAgent == .quiet)
    }

    /// One machine: a repository holding one worktree, with one Session working in it that wrote
    /// its record at `startedAtMs`. `running` is the process table, which a case may move.
    @MainActor private final class Machine {
        let readings: WorldReadings
        private let processes: LiveProcesses

        var running: Bool {
            get { processes.running }
            set { processes.running = newValue }
        }

        init(running: Bool = true) {
            let processes = LiveProcesses(running: running)
            self.processes = processes
            self.readings = WorldReadings(
                engine: Engine(
                    readCheckout: CheckoutFixture().read,
                    readWorktrees: { _ in
                        [WorktreeEntry(
                            path: repository, branch: "main", headSha: "aaa", kind: .main,
                        )]
                    },
                    readWorkspace: { entry in
                        WorkspaceProjection(
                            kind: entry.kind,
                            branch: entry.branch,
                            dirty: 0,
                            divergence: UpstreamDivergence(ahead: 0, behind: 0),
                        )
                    },
                    readLiveness: { processes.running ? [repository] : [] },
                ),
                repositoryURL: { URL(fileURLWithPath: repository) },
                sessions: {
                    [SessionActivity(cwd: repository, lastSeenAtMs: startedAtMs)]
                },
            )
        }

        /// How the roster would read that Session — the one answer a publish exists to move.
        var livenessOfTheAgent: SessionLiveness {
            readings.liveness(inCwd: repository, lastActivityAtMs: startedAtMs)
        }

        func watchingLiveness() -> Tripwire {
            Tripwire.watching { _ = self.livenessOfTheAgent }
        }
    }
}

/// Whether the machine is running an agent, behind a `Mutex` because the process table is read off
/// the main actor.
private final class LiveProcesses: Sendable {
    private let isRunning: Mutex<Bool>

    init(running: Bool) {
        self.isRunning = Mutex(running)
    }

    var running: Bool {
        get { isRunning.withLock { $0 } }
        set { isRunning.withLock { $0 = newValue } }
    }
}

/// A moment the Session wrote its record at, fixed so every case sets its own clock against it.
private let startedAtMs = 1_700_000_000_000

/// The one folder every case turns on, already resolved — `lsof` answers with the symlinks
/// followed, so an unresolved path would never match. Outside the suite because the reads above are
/// handed to an `Engine` and run off the main actor.
private let repository = resolvedPath("/tmp/argo-world")

@testable import ArgoEngine
import Foundation
import Synchronization
import Testing

/// The roster is folded once and held until an input moves (`HubRosterMemo`). These are the cases
/// that say each input really does move it — the half of the memo that matters, because a stale
/// roster is a rendered lie where a slow one is only slow.
///
/// One case per input the fold READS off the world: the join it folds, and the three readings
/// `observed(_:)` decorates every row from. Each reads the roster BEFORE the change, so the memo is
/// warm and holding an answer that has to be given up. The claim-keyed and Hub-held inputs are in
/// `HubRosterLedgerFreshnessTests`.
@Suite("Hub roster freshness")
@MainActor
struct HubRosterFreshnessTests {
    private static let cwd = "/tmp/argo-freshness"

    @Test
    func `a batch landing after the roster was read reaches it`() async {
        let hub = testHub(projectURL: URL(fileURLWithPath: Self.cwd))
        let (observation, events) = hubLiveObservation(id: "batched")

        await hub.startObserving(observation)
        events.yield([.title("First")])
        await settle { hub.sessions.first?.title == "First" }
        events.yield([.title("Second")])
        events.finish()
        await hubTailEnded(hub, transcriptID: "batched")

        #expect(hub.sessions.first?.title == "Second")
    }

    @Test
    func `a transcript joining after the roster was read reaches it`() async {
        let hub = testHub(projectURL: URL(fileURLWithPath: Self.cwd))

        await hubObserveToEnd(hub, hubTestObservation(id: "one", events: [.title("One")]))
        #expect(hub.sessions.map(\.title) == ["One"])
        await hubObserveToEnd(hub, hubTestObservation(id: "two", events: [.title("Two")]))

        #expect(hub.sessions.count == 2)
    }

    @Test
    func `a process the liveness poll has just found reaches the roster`() async {
        let machine = Machine()
        let hub = testHub(
            projectURL: URL(fileURLWithPath: Self.cwd),
            liveness: { machine.liveCwds },
        )
        await hubObserveToEnd(hub, Self.working(id: "polled"))
        await hub.refreshLiveness()
        #expect(hub.sessions.first?.liveness != .live)

        machine.liveCwds = [Self.cwd]
        await hub.refreshLiveness()

        #expect(hub.sessions.first?.liveness == .live)
    }

    @Test
    func `a branch the worktree sweep has just read reaches the roster`() async {
        let machine = Machine(spelling: [Self.cwd: Self.resolvedCwd])
        let hub = Self.hub(of: machine)
        await hubObserveToEnd(hub, Self.working(id: "swept"))
        await hub.refreshWorkspaces()
        #expect(hub.sessions.first?.workspace?.branch == "main")

        machine.branch = "argo/#994"
        await hub.refreshWorkspaces()

        #expect(hub.sessions.first?.workspace?.branch == "argo/#994")
    }

    /// The third reading, isolated: this repository holds no worktree, so the sweep publishes the
    /// same empty table both times and the SPELLING of the Session's folder is the only thing that
    /// moves. Unspelled, the folder matches no live process; spelled, it matches the one `lsof`
    /// reported under the path the file system really uses.
    @Test
    func `a folder spelled for the first time reaches the roster`() async {
        let machine = Machine(worktrees: [])
        let hub = Self.hub(of: machine)
        await hubObserveToEnd(hub, Self.working(id: "spelled"))
        await hub.refreshLiveness()
        #expect(hub.sessions.first?.liveness != .live)

        machine.spelling = [Self.cwd: Self.resolvedCwd]
        await hub.refreshWorkspaces()

        #expect(hub.sessions.first?.liveness == .live)
    }

    private static let resolvedCwd = resolvedFreshnessCwd

    /// A Session mid-turn in this suite's one folder, so its liveness turns on the process table
    /// alone.
    private static func working(id: String) -> TranscriptObservation {
        hubTestObservation(id: id, events: [
            .cwd(cwd),
            .prompt(text: "Work", images: [], atMs: Date().epochMs),
        ])
    }

    /// A machine whose one worktree is this suite's folder on a branch the test moves, whose file
    /// system spells that folder the way the test says, and which is running an agent in it under
    /// the RESOLVED spelling — the shape both readings above are asserted against.
    private static func hub(of machine: Machine) -> Hub {
        Hub(
            projectURL: URL(fileURLWithPath: cwd),
            engine: Engine(reads: .init(
                checkout: CheckoutFixture().read,
                worktrees: { _ in
                    machine.worktrees.map {
                        WorktreeEntry(path: $0, branch: machine.branch, headSha: "aaa", kind: .main)
                    }
                },
                workspace: { entry in
                    WorkspaceProjection(
                        kind: entry.kind,
                        refs: WorkspaceProjection.Refs(branch: entry.branch),
                        drift: WorkspaceProjection.Drift(
                            dirty: 0,
                            divergence: UpstreamDivergence(ahead: 0, behind: 0),
                        ),
                    )
                },
                liveness: { machine.liveCwds },
                paths: { asked in
                    let table = machine.spelling
                    return asked.reduce(into: [String: String]()) { $0[$1] = table[$1] }
                },
            )),
        )
    }
}

/// How the file system really spells this suite's folder — `/tmp` is a symlink on macOS, which is
/// the whole reason the readings hold a spelling at all.
private let resolvedFreshnessCwd = "/private/tmp/argo-freshness"

/// The machine both readings are asked about, mutable because what a poll exists for is the answer
/// CHANGING. Behind a `Mutex` because the reads run off the main actor.
private final class Machine: Sendable {
    private let state: Mutex<State>

    private struct State {
        var branch = "main"
        var spelling: [String: String]
        var worktrees: [String]
        var liveCwds: Set<String>
    }

    init(
        spelling: [String: String] = [:],
        worktrees: [String] = [resolvedFreshnessCwd],
    ) {
        self.state = Mutex(State(
            spelling: spelling,
            worktrees: worktrees,
            liveCwds: [resolvedFreshnessCwd],
        ))
    }

    var branch: String {
        get { state.withLock { $0.branch } }
        set { state.withLock { $0.branch = newValue } }
    }

    var spelling: [String: String] {
        get { state.withLock { $0.spelling } }
        set { state.withLock { $0.spelling = newValue } }
    }

    var worktrees: [String] {
        state.withLock { $0.worktrees }
    }

    var liveCwds: Set<String> {
        get { state.withLock { $0.liveCwds } }
        set { state.withLock { $0.liveCwds = newValue } }
    }
}

@testable import ArgoEngine
import Foundation
import Testing

/// What the roster reads once git and the record store are folded into it — the two facts about a
/// Session that live outside its transcript.
@Suite("Hub workspace and CLI")
@MainActor
struct HubWorkspaceTests {
    private static let cwd = "/tmp/argo-workspace"

    @Test
    func `a Session carries what git said about the worktree it is running in`() async {
        let hub = Self.hub()
        await hubObserveToEnd(hub, Self.observation(id: "worktree"))

        await hub.refreshWorkspaces()

        #expect(hub.sessions.first?.workspace?.branch == "argo/#510")
        #expect(hub.sessions.first?.workspace?.dirty == 3)
    }

    @Test
    func `a Session whose folder has not been read yet claims no Workspace`() async {
        let hub = Self.hub()

        await hubObserveToEnd(hub, Self.observation(id: "unread"))

        // Before the first poll there is no answer, and an unread folder is not a clean one.
        #expect(hub.sessions.first?.workspace == nil)
    }

    /// AC4. An external Session's folder is one Argo read off git and never chose, so how Argo
    /// knows the Session is HERE is an observation rather than its own record.
    @Test
    func `an external Session's Workspace is DERIVED`() async {
        let hub = Self.hub()
        await hubObserveToEnd(hub, Self.observation(id: "external"))

        await hub.refreshWorkspaces()

        #expect(hub.sessions.first?.provenance == .external)
        #expect(hub.sessions.first?.workspace?.held.tier == .derived)
    }

    @Test
    func `a Session is attributed to the CLI whose records it was swept out of`() async {
        let hub = Self.hub()

        await hubObserveToEnd(hub, Self.observation(id: "claude"))

        // A fact about WHERE the record was found, never a guess at the prose inside it.
        #expect(hub.sessions.first?.cli == .claude)
    }

    @Test
    func `the read is dropped with the Project it belonged to`() async {
        let hub = Self.hub()
        await hubObserveToEnd(hub, Self.observation(id: "dropped"))
        await hub.refreshWorkspaces()

        await hub.disconnect()

        // A branch belonging to a repository nobody is pointed at is a fact Argo does not have.
        #expect(hub.readings.workspace(inCwd: Self.cwd) == nil)
    }

    private static func hub() -> Hub {
        Hub(
            projectURL: URL(fileURLWithPath: cwd),
            engine: Engine(reads: .init(
                checkout: CheckoutFixture().read,
                worktrees: { _ in [oneWorktree] },
                workspace: { _ in gitRead },
                liveness: noLiveProcesses,
            )),
        )
    }

    private static func observation(id: String) -> TranscriptObservation {
        hubTestObservation(id: id, events: [.cwd(cwd), .title("Working")])
    }
}

/// The one worktree the repository in this suite holds, which is the folder every Session in it is
/// running in. Outside the suite because the reads are handed to an `Engine`.
private let oneWorktree = WorktreeEntry(
    path: "/tmp/argo-workspace", branch: "argo/#510", headSha: "aaa", kind: .worktree,
)

/// What git would say about that worktree.
private let gitRead = WorkspaceProjection(
    kind: .worktree,
    branch: "argo/#510",
    baseRef: "origin/main",
    headSha: "aaa",
    dirty: 3,
    divergence: UpstreamDivergence(ahead: 1, behind: 0),
)

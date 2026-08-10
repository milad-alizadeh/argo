@testable import ArgoEngine
import Foundation
import Testing

/// What the roster reads once git and the record store are folded into it — the two facts about a
/// Session that live outside its transcript.
@Suite("Hub workspace and CLI")
@MainActor
struct HubWorkspaceTests {
    private static let cwd = "/tmp/argo-workspace"
    private static let read = gitRead

    @Test
    func `a Session carries what git said about the folder it is running in`() async {
        let hub = Self.hub()
        await hubObserveToEnd(hub, Self.observation(id: "worktree"))

        await hub.refreshWorkspaces()

        #expect(hub.sessions.first?.workspace == Self.read)
    }

    @Test
    func `a Session whose folder has not been read yet claims no Workspace`() async {
        let hub = Self.hub()

        await hubObserveToEnd(hub, Self.observation(id: "unread"))

        // Before the first poll there is no answer, and an unread folder is not a clean one.
        #expect(hub.sessions.first?.workspace == nil)
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
        #expect(hub.workspaces.isEmpty)
    }

    private static func hub() -> Hub {
        Hub(
            projectURL: URL(fileURLWithPath: cwd),
            engine: Engine(
                readCheckout: CheckoutFixture().read,
                readWorkspace: { _ in gitRead },
                readLiveness: noLiveProcesses,
            ),
        )
    }

    private static func observation(id: String) -> TranscriptObservation {
        hubTestObservation(id: id, events: [.cwd(cwd), .title("Working")])
    }
}

/// What git would say about the folder every Session in this suite is running in. Outside the
/// suite because the read is handed to an `Engine` and runs off the main actor.
private let gitRead = WorkspaceProjection(
    kind: .worktree,
    branch: "argo/#510",
    dirty: 3,
    unpushed: 1,
)

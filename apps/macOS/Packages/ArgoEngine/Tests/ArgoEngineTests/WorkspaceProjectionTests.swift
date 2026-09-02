@testable import ArgoEngine
import Foundation
import Testing

/// The two facts on a Workspace that are not git's: how many Agents are in the folder, and how Argo
/// knows one is there at all.
@Suite("Workspace holders and tier")
struct WorkspaceProjectionTests {
    private static let read = WorkspaceProjection(
        kind: .worktree,
        refs: WorkspaceProjection.Refs(
            branch: "argo/#259",
            baseRef: "origin/main",
            headSha: "aaa",
        ),
        drift: WorkspaceProjection.Drift(
            dirty: 2,
            divergence: UpstreamDivergence(ahead: 1, behind: 3),
        ),
    )

    @Test
    func `a Session Argo spawned knows its own Workspace DIRECT`() {
        // Argo chose the folder and made the worktree, so the identity is its own record.
        #expect(Self.read.known(via: .managed).held.tier == .direct)
    }

    @Test
    func `a Session Argo never owned reads its Workspace DERIVED`() {
        #expect(Self.read.known(via: .external).held.tier == .derived)
    }

    @Test
    func `an orphaned Session degrades down with the record that went with its process`() {
        // Argo did spawn it, and then lost the PTY — so the folder is read back off git like any
        // other observation (`CONTEXT.md`, the degrade-down rule).
        #expect(Self.read.known(via: .orphaned).held.tier == .derived)
    }

    @Test
    func `neither fold disturbs a single count git reported`() {
        let folded = Self.read.shared(by: 3).known(via: .managed)

        #expect(folded.dirty == 2)
        #expect(folded.divergence == UpstreamDivergence(ahead: 1, behind: 3))
        #expect(folded.branch == "argo/#259")
        #expect(folded.baseRef == "origin/main")
        #expect(folded.headSha == "aaa")
        #expect(folded.kind == .worktree)
    }

    @Test
    func `the two folds are independent of the order they are applied in`() {
        let sharedFirst = Self.read.shared(by: 3).known(via: .managed)
        let tierFirst = Self.read.known(via: .managed).shared(by: 3)

        #expect(sharedFirst == tierFirst)
        #expect(sharedFirst.held == WorkspaceHolders(count: 3, tier: .direct))
    }
}

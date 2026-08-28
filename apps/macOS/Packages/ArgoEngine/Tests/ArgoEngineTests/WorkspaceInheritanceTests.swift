@testable import ArgoEngine
import Foundation
import Testing

/// ADR-0010: workspace identity attaches to any Agent, and an Agent owning none inherits its
/// parent's rather than reporting nothing.
@Suite("Workspace inheritance")
struct WorkspaceInheritanceTests {
    private static let root = workspace(onBranch: "main")
    private static let isolated = workspace(onBranch: "argo/#259")

    @Test
    func `an Agent with a Workspace of its own renders that one`() {
        let resolved = WorkspaceInheritance.resolved(
            ofAgent: "child",
            owned: ["root": Self.root, "child": Self.isolated],
            parents: ["child": "root"],
        )

        // A worktree-isolated Subagent has its own branch, and it is the one that shows.
        #expect(resolved?.branch == "argo/#259")
    }

    @Test
    func `an Agent owning no Workspace inherits its parent's`() {
        let resolved = WorkspaceInheritance.resolved(
            ofAgent: "child",
            owned: ["root": Self.root],
            parents: ["child": "root"],
        )

        // Not nothing: a Subagent in the folder its parent is in is in a folder.
        #expect(resolved?.branch == "main")
    }

    @Test
    func `inheritance walks past an ancestor that owns none either`() {
        let resolved = WorkspaceInheritance.resolved(
            ofAgent: "grandchild",
            owned: ["root": Self.root],
            parents: ["grandchild": "child", "child": "root"],
        )

        #expect(resolved?.branch == "main")
    }

    @Test
    func `the nearest owning ancestor wins, not the root`() {
        let resolved = WorkspaceInheritance.resolved(
            ofAgent: "grandchild",
            owned: ["root": Self.root, "child": Self.isolated],
            parents: ["grandchild": "child", "child": "root"],
        )

        #expect(resolved?.branch == "argo/#259")
    }

    @Test
    func `a root Agent owning no Workspace has none to inherit`() {
        let resolved = WorkspaceInheritance.resolved(
            ofAgent: "root", owned: [:], parents: [:],
        )

        #expect(resolved == nil)
    }

    @Test
    func `a cycle in the parent table answers nothing rather than hanging`() {
        // A `parentId` table read out of a transcript is not proof of a tree.
        let resolved = WorkspaceInheritance.resolved(
            ofAgent: "a", owned: [:], parents: ["a": "b", "b": "a"],
        )

        #expect(resolved == nil)
    }

    private static func workspace(onBranch branch: String) -> WorkspaceProjection {
        WorkspaceProjection(kind: .worktree, branch: branch, dirty: 0, divergence: nil)
    }
}

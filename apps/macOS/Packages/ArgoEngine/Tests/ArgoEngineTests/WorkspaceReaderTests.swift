@testable import ArgoEngine
import Foundation
import Testing

/// What the reader makes of git's answers about one Session's folder, asked of the parse directly
/// rather than through a repository on disk.
@Suite("Workspace reading")
struct WorkspaceReaderTests {
    private static let folderURL = URL(fileURLWithPath: "/tmp/argo")

    @Test
    func `a linked worktree keeps its own git directory beside the shared one`() async {
        let projection = await read([
            insideWorkTree: "true\n",
            gitDirs: "/tmp/argo/.git/worktrees/ticket-510\n/tmp/argo/.git\n",
        ])

        #expect(projection?.isWorktree == true)
    }

    @Test
    func `the primary checkout answers the same path twice, and is not a worktree`() async {
        let projection = await read([
            insideWorkTree: "true\n",
            gitDirs: "/tmp/argo/.git\n/tmp/argo/.git\n",
        ])

        #expect(projection?.isWorktree == false)
    }

    @Test
    func `the porcelain listing is counted a line per changed file`() async {
        let projection = await read([
            insideWorkTree: "true\n",
            status: " M apps/macOS/Argo.swift\n?? notes.md\n M README.md\n",
        ])

        #expect(projection?.dirty == 3)
    }

    @Test
    func `a clean tree counts zero rather than reading as unknown`() async {
        // git answers a clean tree with nothing at all, and nothing at all is also what a folder
        // it cannot read answers — which is why the read is gated on the question above.
        let projection = await read([insideWorkTree: "true\n"])

        #expect(projection?.dirty == 0)
    }

    @Test
    func `commits ahead of the upstream are counted`() async {
        let projection = await read([insideWorkTree: "true\n", unpushed: "2\n"])

        #expect(projection?.unpushed == 2)
    }

    @Test
    func `a branch with no upstream is absent, never zero`() async {
        // git exits non-zero for a branch with nothing to be ahead OF, and "nothing to compare
        // against" is a different fact from "level with it".
        let projection = await read([insideWorkTree: "true\n"])

        #expect(projection?.unpushed == nil)
    }

    @Test(arguments: [[:], [insideWorkTree: "false\n"]])
    func `a folder git cannot answer for reads as nothing at all`(
        answers: [String: String],
    ) async {
        // Not a Workspace of zeroes: a folder deleted under a Session has no clean tree.
        #expect(await read(answers) == nil)
    }

    private func read(_ answers: [String: String]) async -> WorkspaceProjection? {
        await WorkspaceReader(git: gitAnswering(answers)).read(at: Self.folderURL)
    }
}

/// The four questions a Workspace read asks git, as the tables above key them.
private let insideWorkTree = "rev-parse --is-inside-work-tree"
private let gitDirs = "rev-parse --path-format=absolute --git-dir --git-common-dir"
private let status = "status --porcelain"
private let unpushed = "rev-list --count @{upstream}..HEAD"

/// A table of what git would say, keyed by the arguments asked; anything absent is a command that
/// answered nothing.
private func gitAnswering(_ answers: [String: String]) -> GitCommand {
    { arguments, _ in answers[arguments.joined(separator: " ")] }
}

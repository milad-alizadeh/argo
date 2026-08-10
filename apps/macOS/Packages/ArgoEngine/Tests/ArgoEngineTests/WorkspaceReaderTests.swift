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
            status: "",
            gitDirs: "/tmp/argo/.git/worktrees/ticket-510\n/tmp/argo/.git\n",
        ])

        #expect(projection?.kind == .worktree)
    }

    @Test
    func `the primary checkout answers the same path twice, and is not a worktree`() async {
        let projection = await read([
            status: "",
            gitDirs: "/tmp/argo/.git\n/tmp/argo/.git\n",
        ])

        #expect(projection?.kind == .main)
    }

    @Test
    func `the porcelain listing is counted a line per changed file`() async {
        let projection = await read([
            status: " M apps/macOS/Argo.swift\n?? notes.md\n M README.md\n",
        ])

        #expect(projection?.dirty == 3)
    }

    @Test
    func `a clean tree counts zero rather than reading as unknown`() async {
        // An EMPTY answer is a clean tree; NO answer is a folder git could not read, and the
        // case below is what keeps the two from coming out the same.
        #expect(await read([status: ""])?.dirty == 0)
    }

    @Test
    func `commits ahead of the upstream are counted`() async {
        let projection = await read([status: "", unpushed: "2\n"])

        #expect(projection?.unpushed == 2)
    }

    @Test
    func `a branch with no upstream is absent, never zero`() async {
        // git exits non-zero for a branch with nothing to be ahead OF, and "nothing to compare
        // against" is a different fact from "level with it". Asked of a folder that answered
        // everything else, so the absence is the upstream's and not the read's.
        let projection = await read([status: " M README.md\n", branch: "main\n"])

        #expect(projection?.dirty == 1)
        #expect(projection?.unpushed == nil)
    }

    @Test
    func `the branch is read at the same moment as the counts beside it`() async {
        let projection = await read([status: "", branch: "argo/#510-session-header-facts\n"])

        #expect(projection?.branch == "argo/#510-session-header-facts")
    }

    @Test
    func `a detached HEAD names no branch`() async {
        // `HEAD` is what git answers there, and it is not a name anybody can check out.
        #expect(await read([status: "", branch: "HEAD\n"])?.branch == nil)
    }

    @Test
    func `a folder git will not count for reads as nothing at all`() async {
        // Not a Workspace of zeroes: a folder deleted under a Session has no clean tree, and a
        // read that answered `0 dirty` there would be a false DIRECT (`CONTEXT.md`).
        #expect(await read([branch: "main\n"]) == nil)
    }

    private func read(_ answers: [String: String]) async -> WorkspaceProjection? {
        await WorkspaceReader(git: gitAnswering(answers)).read(at: Self.folderURL)
    }
}

/// The four questions a Workspace read asks git, as the tables above key them.
private let gitDirs = "rev-parse --path-format=absolute --git-dir --git-common-dir"
private let branch = "rev-parse --abbrev-ref HEAD"
private let status = "status --porcelain --untracked-files=all"
private let unpushed = "rev-list --count @{upstream}..HEAD"

/// A table of what git would say, keyed by the arguments asked; anything absent is a command that
/// answered nothing.
private func gitAnswering(_ answers: [String: String]) -> GitCommand {
    { arguments, _ in answers[arguments.joined(separator: " ")] }
}

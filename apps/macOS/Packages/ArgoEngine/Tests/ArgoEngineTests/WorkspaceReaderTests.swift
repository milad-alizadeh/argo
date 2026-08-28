@testable import ArgoEngine
import Foundation
import Testing

/// What the reader makes of git's answers about one working tree, asked of the parse directly
/// rather than through a repository on disk.
@Suite("Workspace reading")
struct WorkspaceReaderTests {
    @Test
    func `the primary checkout git listed first is the main kind`() async {
        #expect(await read([status: ""], of: Self.primary)?.kind == .main)
    }

    @Test
    func `a linked worktree is the worktree kind`() async {
        #expect(await read([status: ""], of: Self.linked)?.kind == .worktree)
    }

    @Test
    func `the branch and the head come from the listing, not a second read of them`() async {
        // Asking git again would be a second chance to disagree with the listing that found the
        // worktree in the first place (#259).
        let projection = await read([status: ""], of: Self.linked)

        #expect(projection?.branch == "argo/#259-workspace-git-observer")
        #expect(projection?.headSha == "d19907e7bb23edc1bc001cfc7d9607b40cc0685c")
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
    func `both sides of the divergence come from one reading of one range`() async {
        // Left of the three dots is what the upstream has and HEAD does not; right is the reverse.
        let projection = await read([status: "", divergence: "4\t2\n"])

        #expect(projection?.divergence == UpstreamDivergence(ahead: 2, behind: 4))
    }

    @Test
    func `a branch with no upstream has no divergence at all, never two zeroes`() async {
        // git exits non-zero for a branch with nothing to be ahead OF, and "nothing to compare
        // against" is a different fact from "level with it".
        let projection = await read([status: " M README.md\n"])

        #expect(projection?.dirty == 1)
        #expect(projection?.divergence == nil)
    }

    @Test
    func `a half-read range is no divergence rather than one number`() async {
        #expect(await read([status: "", divergence: "4\n"])?.divergence == nil)
    }

    @Test
    func `the base is the remote's own default head, as git names it`() async {
        #expect(await read([status: "", baseRef: "origin/main\n"])?.baseRef == "origin/main")
    }

    @Test
    func `a repository with no remote names no base`() async {
        // Every owned Workspace branches from the Project's shared base, and a repository with no
        // remote has none to name.
        #expect(await read([status: ""])?.baseRef == nil)
    }

    @Test
    func `a reading nothing has said whose tier it is degrades down`() async {
        // The reader knows git's counts and nothing about who is standing in the folder, so the
        // tier it produces is the quieter one until something that knows the provenance says
        // otherwise (`CONTEXT.md`, the degrade-down rule).
        #expect(await read([status: ""])?.tier == .derived)
        #expect(await read([status: ""])?.sharedCount == 0)
    }

    @Test
    func `a worktree git will not count for reads as nothing at all`() async {
        // Not a Workspace of zeroes: a folder deleted under a Session has no clean tree, and a
        // read that answered `0 dirty` there would be a false DIRECT (`CONTEXT.md`).
        #expect(await read([baseRef: "origin/main\n"]) == nil)
    }

    private static let primary = WorktreeEntry(
        path: "/repo", branch: "main",
        headSha: "36e755ec341247fe58209dbf5a22bde41811dc9b", isPrimary: true,
    )

    private static let linked = WorktreeEntry(
        path: "/repo/.claude/worktrees/ticket-259", branch: "argo/#259-workspace-git-observer",
        headSha: "d19907e7bb23edc1bc001cfc7d9607b40cc0685c", isPrimary: false,
    )

    private func read(
        _ answers: [String: String], of entry: WorktreeEntry = Self.linked,
    ) async
        -> WorkspaceProjection? {
        await WorkspaceReader(git: gitAnswering(answers)).read(entry)
    }
}

/// The three questions a Workspace read asks git, as the tables above key them. The branch, the
/// head and the kind are not among them: the listing already answered those.
private let status = "status --porcelain --untracked-files=all"
private let baseRef = "rev-parse --abbrev-ref origin/HEAD"
private let divergence = "rev-list --count --left-right @{upstream}...HEAD"

/// A table of what git would say, keyed by the arguments asked; anything absent is a command that
/// answered nothing.
private func gitAnswering(_ answers: [String: String]) -> GitCommand {
    { arguments, _ in answers[arguments.joined(separator: " ")] }
}

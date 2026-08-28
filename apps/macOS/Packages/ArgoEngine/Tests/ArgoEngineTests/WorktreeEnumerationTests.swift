@testable import ArgoEngine
import Foundation
import Testing

/// What Argo makes of `git worktree list --porcelain` — the one read that knows a worktree exists
/// whether or not a Session is running in it (#259).
@Suite("Worktree enumeration")
struct WorktreeEnumerationTests {
    private static let listing = """
    worktree /repo
    HEAD 36e755ec341247fe58209dbf5a22bde41811dc9b
    branch refs/heads/main

    worktree /repo/.claude/worktrees/ticket-259
    HEAD d19907e7bb23edc1bc001cfc7d9607b40cc0685c
    branch refs/heads/argo/#259-workspace-git-observer
    locked claude session ticket-259 (pid 46669 start Fri Aug 28 09:44:07 2026)

    """

    @Test
    func `every worktree the repository holds is listed, in git's own order`() {
        let entries = WorktreeEntry.list(porcelain: Self.listing)

        #expect(entries.map(\.path) == ["/repo", "/repo/.claude/worktrees/ticket-259"])
    }

    @Test
    func `the branch is git's own ref with the heads prefix taken off`() {
        let entries = WorktreeEntry.list(porcelain: Self.listing)

        // Including the `#` — a ref is read verbatim, and Argo's own branch names carry one.
        #expect(entries.map(\.branch) == ["main", "argo/#259-workspace-git-observer"])
    }

    @Test
    func `git lists the repository's own checkout first, and nothing else is main`() {
        let entries = WorktreeEntry.list(porcelain: Self.listing)

        // Read off the position git put it in, never off a path: `.claude/worktrees/` is Argo's
        // own habit and a worktree can sit anywhere at all.
        #expect(entries.map(\.kind) == [.main, .worktree])
    }

    @Test
    func `the head commit is carried whole, as the ref a Diff is addressed by`() {
        let entries = WorktreeEntry.list(porcelain: Self.listing)

        #expect(entries.first?.headSha == "36e755ec341247fe58209dbf5a22bde41811dc9b")
    }

    @Test
    func `a lock line is not read as a fact about the branch`() {
        let entries = WorktreeEntry.list(porcelain: Self.listing)

        // `locked` carries free prose from whoever took the lock, and it names no ref.
        #expect(entries.last?.branch == "argo/#259-workspace-git-observer")
    }

    @Test
    func `a detached worktree names no branch`() {
        let entries = WorktreeEntry.list(porcelain: """
        worktree /repo
        HEAD 36e755ec341247fe58209dbf5a22bde41811dc9b
        detached

        """)

        // Its HEAD is still a commit, and it is still a folder — only the name is missing.
        #expect(entries.map(\.branch) == [nil])
        #expect(entries.first?.headSha == "36e755ec341247fe58209dbf5a22bde41811dc9b")
    }

    @Test
    func `a bare repository's own entry is no Workspace, and takes main with it`() {
        let entries = WorktreeEntry.list(porcelain: """
        worktree /repo.git
        bare

        worktree /repo/checkout
        HEAD d19907e7bb23edc1bc001cfc7d9607b40cc0685c
        branch refs/heads/main

        """)

        // A bare repository holds no working tree, so it has no MAIN one either — and the linked
        // worktree beside it must not inherit that word by being first left standing.
        #expect(entries.map(\.path) == ["/repo/checkout"])
        #expect(entries.map(\.kind) == [.worktree])
    }

    @Test
    func `a folder git will not answer for holds no worktrees at all`() async {
        let listed = await WorktreeEnumerationReader(git: { _, _ in nil }).list(in: Self.folderURL)

        #expect(listed.isEmpty)
    }

    @Test
    func `the reader asks git for the porcelain listing and parses what comes back`() async {
        let reader = WorktreeEnumerationReader { arguments, _ in
            arguments == ["worktree", "list", "--porcelain"] ? Self.listing : nil
        }

        #expect(await reader.list(in: Self.folderURL).count == 2)
    }

    private static let folderURL = URL(fileURLWithPath: "/repo")
}

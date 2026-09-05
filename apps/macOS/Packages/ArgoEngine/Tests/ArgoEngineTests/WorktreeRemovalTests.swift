@testable import ArgoEngine
import Foundation
import Testing

/// The engine's one repository WRITE, run against a real repository (#1398).
///
/// Against real git rather than a scripted invocation, because what is being claimed is that a
/// folder is gone off disk and a ref with it — and a stub asserting the argv would pass just as
/// well with `worktree remove` spelled wrong.
@Suite("Worktree removal")
struct WorktreeRemovalTests {
    @Test
    func `a landed worktree is taken off disk and its branch deleted with it`() async throws {
        let repository = try GitWorktreeFixture()
        defer { repository.remove() }
        let candidate = try repository.worktree(named: "ticket-1398-archive")

        let removal = await WorktreeRemover().remove(candidate, from: repository.rootURL)

        #expect(removal == .removed)
        #expect(!FileManager.default.fileExists(atPath: candidate.path))
        #expect(!repository.branches().contains(candidate.branch))
    }

    @Test
    func `a branch git will not delete still leaves the worktree gone`() async throws {
        let repository = try GitWorktreeFixture()
        defer { repository.remove() }
        let candidate = try repository.worktree(named: "ticket-1398-checked-out")
        // The name the repository's OWN checkout is on, which git refuses to delete while it is
        // checked out. Archiving asked for the folder, and it got the folder.
        let onTheMainBranch = WorktreeReaping.Candidate(
            path: candidate.path, branch: repository.defaultBranch,
        )

        let removal = await WorktreeRemover().remove(onTheMainBranch, from: repository.rootURL)

        #expect(removal == .removed)
        #expect(!FileManager.default.fileExists(atPath: candidate.path))
    }

    @Test
    func `a folder that is no worktree of this repository is refused in git's own words`() async
        throws {
        let repository = try GitWorktreeFixture()
        defer { repository.remove() }
        let stranger = WorktreeReaping.Candidate(path: "/tmp/not-a-worktree", branch: "nobody")

        let removal = await WorktreeRemover().remove(stranger, from: repository.rootURL)

        guard case let .refused(reason) = removal else {
            Issue.record("git removed a folder it does not hold")
            return
        }
        #expect(reason.contains("not a working tree"))
    }

    @Test
    func `a worktree with uncommitted changes is refused rather than emptied`() async throws {
        let repository = try GitWorktreeFixture()
        defer { repository.remove() }
        let candidate = try repository.worktree(named: "ticket-1398-dirty")
        try repository.dirty(candidate)

        let removal = await WorktreeRemover().remove(candidate, from: repository.rootURL)

        // `WorktreeReaping` refuses this long before git sees it. Asserted anyway: the rule and
        // git are two independent guards on the one irreversible act in the engine.
        #expect(removal != .removed)
        #expect(FileManager.default.fileExists(atPath: candidate.path))
    }
}

/// A real repository with one commit, and linked worktrees made on demand under
/// `.claude/worktrees/` — the shape Argo's own trees have.
private struct GitWorktreeFixture {
    let rootURL: URL
    let defaultBranch = "main"

    private let containerURL: URL

    init() throws {
        self.containerURL = URL(fileURLWithPath: NSTemporaryDirectory())
            .appending(path: "argo-reap-\(UUID().uuidString)", directoryHint: .isDirectory)
        self.rootURL = containerURL.appending(path: "repository", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: rootURL, withIntermediateDirectories: true)
        try run(["git", "init", "--quiet", "--initial-branch", defaultBranch, rootURL.path])
        try "let a = 1\n".write(
            to: rootURL.appending(path: "a.swift"), atomically: true, encoding: .utf8,
        )
        try run(["git", "-C", rootURL.path, "add", "-A"])
        try run([
            "git", "-C", rootURL.path,
            "-c", "user.name=Ada Lovelace", "-c", "user.email=ada@example.com",
            "commit", "--quiet", "-m", "the first file",
        ])
    }

    func remove() {
        try? FileManager.default.removeItem(at: containerURL)
    }

    /// One linked worktree on a branch of its own, named the way Argo names them.
    func worktree(named name: String) throws -> WorktreeReaping.Candidate {
        let path = rootURL
            .appending(path: ".claude/worktrees", directoryHint: .isDirectory)
            .appending(path: name, directoryHint: .isDirectory).path
        let branch = "argo/#1398-\(name)"
        try run(["git", "-C", rootURL.path, "worktree", "add", "--quiet", "-b", branch, path])
        return WorktreeReaping.Candidate(path: path, branch: branch)
    }

    /// Leaves an uncommitted change in a worktree.
    func dirty(_ candidate: WorktreeReaping.Candidate) throws {
        try "let a = 2\n".write(
            to: URL(fileURLWithPath: candidate.path).appending(path: "a.swift"),
            atomically: true,
            encoding: .utf8,
        )
    }

    /// Every branch the repository has, by name.
    func branches() -> [String] {
        let listed = gitCommand(
            ["for-each-ref", "--format=%(refname:short)", "refs/heads"], rootURL,
        )
        return listed?.split(whereSeparator: \.isNewline).map(String.init) ?? []
    }

    private func run(_ arguments: [String]) throws {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        process.arguments = arguments
        // The machine's own git config taken out of the way, for `AtlasRepositoryFixture`'s
        // reason: `init.defaultBranch` and `commit.gpgsign` would otherwise change what this is.
        var environment = ProcessInfo.processInfo.environment
        environment["GIT_CONFIG_GLOBAL"] = "/dev/null"
        environment["GIT_CONFIG_SYSTEM"] = "/dev/null"
        process.environment = environment
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice
        try process.run()
        process.waitUntilExit()
    }
}

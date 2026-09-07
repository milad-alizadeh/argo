@testable import ArgoEngine
import Foundation
import Testing

/// What the real `git` adapter keeps of an invocation, against real repositories (#1045).
///
/// The claim these exist for is that stderr is a value: §5 of `cockpit-failure-states-spec.md`
/// makes git's own diagnostic the actionable half of a git failure, and the first git write to
/// land must be able to hand it on rather than send it to `/dev/null`.
@Suite("Git answers")
struct GitAnswerTests {
    @Test
    func `a folder that is no repository carries git's own diagnostic`() throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        let plain = try fixture.folder("plain")
        let answer = try #require(gitInvocation(["rev-parse", "--show-toplevel"], plain))
        #expect(!answer.isSuccess)
        #expect(answer.errorOutput.contains("not a git repository"))
    }

    @Test
    func `a read that worked answers git's own words on stdout`() throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        let repository = try fixture.folder("repo", git: true)
        let answer = try #require(gitInvocation(["rev-parse", "--show-toplevel"], repository))
        #expect(answer.isSuccess)
        // By its tail, because git answers the real path and a temporary folder sits under a
        // symlink `/var` that neither URL nor `standardized` resolves.
        #expect(answer.output?.hasSuffix("/\(fixture.rootURL.lastPathComponent)/repo\n") == true)
    }

    @Test
    func `a read that worked prints nothing on stderr`() throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        let repository = try fixture.folder("repo", git: true)
        let answer = try #require(gitInvocation(["rev-parse", "--show-toplevel"], repository))
        #expect(answer.errorOutput.isEmpty)
    }

    /// The four read paths are unchanged by any of this: they see one string or nothing, and a
    /// refusal is still nothing.
    @Test
    func `the reads still collapse a refusal to absence`() throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        let plain = try fixture.folder("plain")
        #expect(gitCommand(["rev-parse", "--show-toplevel"], plain) == nil)
    }

    @Test
    func `the reads still take git's answer verbatim`() throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        let repository = try fixture.folder("repo", git: true)
        let read = try #require(gitCommand(["rev-parse", "--show-toplevel"], repository))
        // Untrimmed, so a read that had wrapped or cut the answer would not pass: git ends its
        // own with a newline, and every caller is the thing that trims it.
        #expect(read.hasSuffix("/\(fixture.rootURL.lastPathComponent)/repo\n"))
    }

    /// The other half of that claim: git printing NOTHING is an answer (#1680). `git status
    /// --porcelain` in a tree with nothing uncommitted in it exits zero on an empty stdout.
    ///
    /// Against real git because a stub is what hid it: the reader's own suite hands it `""` for a
    /// clean tree and has always passed, while nothing on this side of the seam could produce that
    /// string.
    @Test
    func `a read git answered nothing to is empty rather than absent`() throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        let repository = try fixture.folder("repo", git: true)

        let read = gitCommand(["status", "--porcelain", "--untracked-files=all"], repository)

        // `?.isEmpty == true` rather than `== ""`: `nil` is the reading this is about, and it
        // answers `nil` here rather than `true` (`empty_string`, `apps/macOS/.swiftlint.yml`).
        #expect(read?.isEmpty == true)
    }

    /// What that silence costs one layer up, and the reading #1680 was filed off: a clean worktree
    /// is a Workspace, where before the whole projection was `nil` — no branch, and so no Delivery,
    /// for the rest of the Session, because a clean tree stays clean.
    ///
    /// `dirty` is the assertion and the branch is not: the reader copies that off the entry it was
    /// handed and never asks git for it (`WorkspaceReader`), so expecting it back would assert this
    /// suite's own fixture.
    @Test
    func `a clean worktree is a Workspace, not a folder git could not read`() async throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        let repository = try fixture.folder("repo", git: true)
        let entry = WorktreeEntry(
            path: repository.path, branch: "argo/#1680", headSha: nil, kind: .worktree,
        )

        let projection = await WorkspaceReader().read(entry)

        #expect(projection?.dirty == 0)
    }

    /// The three causes `printedText` keeps apart, which is what lets the two tests above disagree
    /// about `nil`. Folding them back together would read an undecodable answer as a clean tree —
    /// defaulting an unknown, which `docs/domain/honesty-tier.md` forbids in exactly this
    /// direction.
    @Test
    func `a pipe that printed nothing is empty, and one nobody could read is absent`() {
        #expect(printedText(.success(nil))?.isEmpty == true)
        #expect(printedText(.success(Data()))?.isEmpty == true)
        #expect(printedText(.success(Data("porcelain\n".utf8))) == "porcelain\n")
        // A lone continuation byte: UTF-8 has no character that starts this way.
        #expect(printedText(.success(Data([0x80]))) == nil)
        #expect(printedText(.failure(CocoaError(.fileReadUnknown))) == nil)
    }
}

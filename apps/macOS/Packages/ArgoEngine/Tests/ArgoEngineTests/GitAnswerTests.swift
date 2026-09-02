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
}

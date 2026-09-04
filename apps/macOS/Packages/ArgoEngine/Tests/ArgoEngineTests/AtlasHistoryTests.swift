@testable import ArgoEngine
import Foundation
import Testing

/// One commit as git printed it, for the log below to spell out.
private struct LoggedCommit {
    let author: String
    let date: String
    let paths: [String]
}

/// git's answer, in the shape `AtlasHistory.logArguments` asks for: `\u{01}` opens a commit,
/// `\u{1f}` divides its fields, and a NUL ends every record. The newline after a commit's own
/// record is git's, not this fixture's — it is there in the real output too. The SHA is a
/// constant, because nothing measures it.
private func log(_ commits: [LoggedCommit]) -> String {
    commits.map { commit in
        "\u{01}0f1e2d\u{1f}\(commit.author)\u{1f}\(commit.date)\0"
            + (commit.paths.isEmpty ? "" : "\n" + commit.paths.map { $0 + "\0" }.joined())
    }.joined() + "\n"
}

/// What one `git log` pass says about each path, asked of the parse directly.
///
/// The generation suite next door measures a real repository; this one holds git's output still,
/// because the shapes that break a parse — a merge that names no file, a path with a space in it,
/// a commit whose date git spells with an offset rather than a `Z` — are awkward to arrange as
/// commits and trivial to write down.
@Suite("Atlas history")
struct AtlasHistoryTests {
    @Test
    func `a path carries the commits that touched it`() {
        let history = AtlasHistory(readingLog: log([
            LoggedCommit(author: "Ada", date: "2026-03-02T09:00:00Z", paths: ["main.swift"]),
            LoggedCommit(
                author: "Grace", date: "2026-02-02T09:00:00Z", paths: ["main.swift", "README.md"],
            ),
            LoggedCommit(author: "Ada", date: "2026-01-05T09:00:00Z", paths: ["main.swift"]),
        ]))

        #expect(history["main.swift"]?.commits == 3)
        #expect(history["README.md"]?.commits == 1)
    }

    @Test
    func `a path two people touched carries both of them once`() {
        let history = AtlasHistory(readingLog: log([
            LoggedCommit(author: "Ada", date: "2026-03-02T09:00:00Z", paths: ["main.swift"]),
            LoggedCommit(author: "Grace", date: "2026-02-02T09:00:00Z", paths: ["main.swift"]),
            LoggedCommit(author: "Ada", date: "2026-01-05T09:00:00Z", paths: ["main.swift"]),
        ]))

        #expect(history["main.swift"]?.authors == ["Ada", "Grace"])
    }

    /// git walks newest first, so this is the FIRST commit naming the path rather than the last —
    /// the one thing about the order this parse depends on.
    @Test
    func `a path's last commit is the most recent one naming it`() {
        let history = AtlasHistory(readingLog: log([
            LoggedCommit(author: "Ada", date: "2026-03-02T09:00:00Z", paths: ["README.md"]),
            LoggedCommit(
                author: "Ada", date: "2026-01-05T09:00:00Z", paths: ["README.md", "main.swift"],
            ),
        ]))

        #expect(history["README.md"]?.lastCommittedAt == Date(iso8601: "2026-03-02T09:00:00Z"))
        #expect(history["main.swift"]?.lastCommittedAt == Date(iso8601: "2026-01-05T09:00:00Z"))
    }

    /// A merge git shows no files for is a commit that touched no path, and counting it against
    /// the previous commit's paths is what a parse that carries state forward does.
    @Test
    func `a commit naming no file touches nothing`() {
        let history = AtlasHistory(readingLog: log([
            LoggedCommit(author: "Ada", date: "2026-03-02T09:00:00Z", paths: []),
            LoggedCommit(author: "Grace", date: "2026-01-05T09:00:00Z", paths: ["main.swift"]),
        ]))

        #expect(history["main.swift"]?.commits == 1)
        #expect(history["main.swift"]?.authors == ["Grace"])
    }

    /// The reason the log is asked for NUL-separated: without `-z` git QUOTES these two, and a
    /// quoted path joins nothing in the working tree.
    @Test
    func `a path with a space or outside ASCII arrives whole`() {
        let history = AtlasHistory(readingLog: log([
            LoggedCommit(author: "Ada", date: "2026-01-05T09:00:00Z", paths: [
                "notes/a file with spaces.txt",
                "notes/café.txt",
            ]),
        ]))

        #expect(history["notes/a file with spaces.txt"]?.commits == 1)
        #expect(history["notes/café.txt"]?.commits == 1)
    }

    /// `%cI` spells an offset where the committer had one, and a `Z` where they did not. Both are
    /// the same instant to read.
    @Test
    func `a committer's own offset reads as the instant it names`() {
        let history = AtlasHistory(readingLog: log([
            LoggedCommit(author: "Ada", date: "2026-01-05T09:00:00+01:00", paths: ["main.swift"]),
        ]))

        #expect(history["main.swift"]?.lastCommittedAt == Date(iso8601: "2026-01-05T08:00:00Z"))
    }

    /// What a repository with no commits gives: git refuses `log` outright, and the reader has to
    /// carry on and measure the working tree anyway.
    @Test
    func `no output at all is no history`() {
        #expect(AtlasHistory(readingLog: "")["main.swift"] == nil)
    }
}

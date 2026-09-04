import Foundation

/// `%cI` spells a `Z` where the committer was on UTC and an offset where they were not, and this
/// style reads both as the instant they name — measured, not assumed.
private let committerDates = Date.ISO8601FormatStyle()

/// What git's history says about one path: how often it was committed, by whom, and when last.
struct AtlasPathHistory: Equatable, Sendable {
    var commits: Int
    /// Authors by NAME, which is what the Map fixture's own `authors` was measured as. An identity
    /// git has no better answer for: an email would count one person with two addresses twice.
    var authors: Set<String>
    var lastCommittedAt: Date
}

/// One `git log` pass over a repository, read into a history per path (#1148).
///
/// One pass rather than a `git log` per file: a repository of a few thousand files would otherwise
/// spawn a few thousand subprocesses, and the whole map is generated on one gesture.
struct AtlasHistory: Sendable {
    /// The invocation this parse reads, so the format string and the reader cannot drift apart.
    ///
    /// `-z` because without it git QUOTES a path with a space or a byte outside ASCII, and a quoted
    /// path joins nothing in the working tree. `--no-renames` because rename detection is on by
    /// default through `diff.renames` and off wherever a machine's config says so — a measurement
    /// that changes with the reader's git config is not a measurement.
    static let logArguments = [
        "log", "--format=%x01%H%x1f%an%x1f%cI", "--name-only", "--no-renames", "-z",
    ]

    private let paths: [String: AtlasPathHistory]

    /// What each commit touched, in the order git answered in and each path once (#1149). The
    /// co-change counting reads this rather than asking git a second time: the pairs and the
    /// per-path measures are the same walk, so they cannot come from two readings of a repository
    /// that was committed to in between.
    let commits: [[String]]

    subscript(path: String) -> AtlasPathHistory? {
        paths[path]
    }

    /// Reads git's answer. Anything it cannot make sense of is dropped rather than raised: this is
    /// one of five measures, and a history that would not parse must not take the map with it.
    ///
    /// The output is one record per commit — `\u{01}`, the SHA, the author and the date, all
    /// NUL-terminated — followed by that commit's paths, each NUL-terminated in turn. git puts a
    /// newline between a commit's own record and the first path under it, which is why the strip
    /// below is conditional: a path can hold a newline, and only the one following a commit record
    /// is git's.
    init(readingLog output: String) {
        var paths: [String: AtlasPathHistory] = [:]
        var commits: [[String]] = []
        var touched: [String] = []
        var seen: Set<String> = []
        var commit: AtlasCommit?
        var afterCommit = false
        /// One commit's paths, closed off when the next commit record arrives and at the end of
        /// git's answer. A path is kept ONCE: a path listed twice under one commit would pair with
        /// itself and count as two commits' worth of company for everything beside it.
        func closeCommit() {
            commits.append(touched)
            touched = []
            seen = []
        }
        // The trailing newline git ends the whole answer with would otherwise read as a path.
        let answer = output.trimmingCharacters(in: .newlines)
        for field in answer.split(separator: "\0", omittingEmptySubsequences: false) {
            var text = field
            if afterCommit, text.hasPrefix("\n") {
                text = text.dropFirst()
            }
            afterCommit = false
            guard !text.isEmpty else { continue }
            if text.hasPrefix("\u{01}") {
                if commit != nil {
                    closeCommit()
                }
                commit = AtlasHistory.commit(text.dropFirst())
                afterCommit = true
                continue
            }
            guard let commit else { continue }
            let path = String(text)
            if seen.insert(path).inserted {
                touched.append(path)
            }
            paths[path, default: AtlasPathHistory(
                commits: 0, authors: [], lastCommittedAt: .distantPast,
            )].touched(by: commit)
        }
        if commit != nil {
            closeCommit()
        }
        self.paths = paths
        self.commits = commits
    }

    /// One commit record: the SHA, the author and the date, divided by `\u{1f}`. The SHA is read
    /// past because nothing measures it, and a record that is not those three fields leaves the
    /// paths under it with no commit to count against rather than counting them against the
    /// previous one.
    private static func commit(_ record: Substring) -> AtlasCommit? {
        let fields = record.split(separator: "\u{1f}", omittingEmptySubsequences: false)
        guard fields.count == 3,
              let committedAt = try? committerDates.parse(String(fields[2]))
        else { return nil }
        return AtlasCommit(author: String(fields[1]), committedAt: committedAt)
    }
}

/// Who made one commit and when. The SHA is not here: nothing measures it.
private struct AtlasCommit {
    let author: String
    let committedAt: Date
}

private extension AtlasPathHistory {
    /// The LATEST date wins rather than the first one seen. `git log` walks newest first by commit
    /// date, but that order is only as monotonic as the clocks that wrote it: a branch committed on
    /// a machine running fast merges in ahead of commits listed before it, and a path it touched
    /// would otherwise read as older than it is.
    mutating func touched(by commit: AtlasCommit) {
        commits += 1
        authors.insert(commit.author)
        lastCommittedAt = max(lastCommittedAt, commit.committedAt)
    }
}

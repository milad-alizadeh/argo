import AtlasLayout
import Foundation

/// Measuring a repository into a Map (#1148).
///
/// An actor because it blocks on subprocesses and on the file system, and the caller is the main
/// actor: ADR-0028 rule 6 is that the main actor opens no file, spawns no process and resolves no
/// path.
///
/// The repository is the ONLY source (#655). Every measure below is one any git repository yields
/// with no prior setup, so nothing here reads `CONTEXT.md`, `AGENTS.md`, `docs/adr/` or `rules/` —
/// a Project that has never met Argo draws the same map as this one.
actor AtlasMapGenerator {
    private let git: GitCommand
    private let now: @Sendable () -> Date

    init(git: @escaping GitCommand = gitCommand, now: @escaping @Sendable () -> Date = Date.init) {
        self.git = git
        self.now = now
    }

    /// The whole repository, measured: four `git` invocations and one read per file. The history is
    /// asked for ONCE rather than once per path, because a repository of a few thousand files would
    /// otherwise spawn a few thousand subprocesses on one gesture — this repository's 2,705 files
    /// and 18,402 couplings measure in 1.7 seconds as it stands.
    func measure(at candidateURL: URL) -> AtlasMap {
        // A folder git will not name a root for is measured as itself and comes out empty. It
        // cannot be a registered Project — registration resolves to a repository root — so this is
        // a degradation rather than a case, and an empty map beats no answer.
        let repositoryURL = gitValue(git, ["rev-parse", "--show-toplevel"], at: candidateURL)
            .map { URL(fileURLWithPath: $0).standardizedFileURL } ?? candidateURL
        let history = AtlasHistory(
            readingLog: git(AtlasHistory.logArguments, repositoryURL) ?? "",
        )
        let measuredAt = now()
        let tracked = paths(at: repositoryURL)
        let files = tracked.map { path in
            AtlasMeasuredFile(
                path: path,
                measures: AtlasFileMeasures.measured(at: repositoryURL.appending(path: path))
                    .merging(committed(path, in: history, at: measuredAt)) { own, _ in own },
            )
        }
        let name = repositoryURL.lastPathComponent
        return AtlasMap(
            measuredAt: measuredAt,
            // Absent for a repository with no commits, which still gets a map: git refuses to name
            // a HEAD that no commit is under.
            commit: gitValue(git, ["rev-parse", "HEAD"], at: repositoryURL),
            root: AtlasNesting.plate(named: name, holding: files),
            couplings: AtlasCoChange.couplings(
                over: history.commits, among: tracked, under: name,
            ),
        )
    }

    /// Every TRACKED path, in git's own order. Tracked rather than walked, so what is ignored and
    /// what was never added are both absent without Argo holding an opinion about either: the line
    /// is committed versus not, and it is drawn at the repository's boundary rather than at ours.
    ///
    /// `-z` because git quotes a path with a space or a byte outside ASCII otherwise, and a quoted
    /// path joins nothing on disk. A path is kept once: a working tree in the middle of a merge
    /// lists a conflicted path once per stage, and three Plots at one path is a Map that cannot be
    /// written.
    private func paths(at repositoryURL: URL) -> [String] {
        var seen: Set<String> = []
        return (git(["ls-files", "-z"], repositoryURL) ?? "")
            .split(separator: "\0")
            .map(String.init)
            .filter { seen.insert($0).inserted }
    }

    /// What the history says about one path. A path git has no history for — added to the index and
    /// never committed — carries none of these rather than three zeroes, which would read as a file
    /// nobody has ever touched.
    private func committed(
        _ path: String,
        in history: AtlasHistory,
        at measuredAt: Date,
    )
        -> [String: Double] {
        guard let entry = history[path] else { return [:] }
        let weeks = measuredAt.timeIntervalSince(entry.lastCommittedAt) / (7 * 24 * 60 * 60)
        return [
            "commits": Double(entry.commits),
            "authors": Double(entry.authors.count),
            // Whole weeks, and never fewer than none: a commit stamped ahead of this machine's
            // clock is a clock disagreement, not a file from the future.
            "age_in_weeks": max(0, weeks.rounded(.down)),
        ]
    }
}

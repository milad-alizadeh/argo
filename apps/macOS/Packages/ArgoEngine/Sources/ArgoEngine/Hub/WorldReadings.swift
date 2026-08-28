import Foundation

/// What Argo read about the world OUTSIDE the transcripts: which working directories a live CLI was
/// running in when the process table was last read, when that read was taken, and what git last
/// said about each Session's folder.
///
/// Polled rather than watched — a process exiting writes nothing anywhere Argo could be listening
/// for it. Both reads are on the same beat because both go stale the same way.
@MainActor
@Observable
final class WorldReadings {
    /// Between reads a Session that has just exited still reads as it last did. Paid in the honest
    /// direction: the stale answer is the quieter one, and the recency window bounds it.
    static let interval = Duration.seconds(5)

    @ObservationIgnored private let engine: Engine
    /// The repository to enumerate worktrees of. Supplied rather than held for the reason the
    /// folders below are: the Hub re-points, and a held URL would go on answering for the Project
    /// it was pointed at first.
    @ObservationIgnored private let repositoryURL: @MainActor () -> URL?
    /// Which folders Agents are working in, to say how many are in each worktree. Supplied rather
    /// than held, because the answer is read off the roster and the roster is read off these
    /// readings.
    @ObservationIgnored private let sessionCwds: @MainActor () -> [String]

    private var liveCwds: Set<String> = []
    /// Absent until a read has happened, so an unread liveness degrades down to quiet rather than
    /// up to a running Argo never saw.
    private var readAtMs: Int?
    /// What git said about each worktree, keyed by the folder git holds it in with its symlinks
    /// already followed — every worktree the repository has, not only the ones a Session is running
    /// in (#259). Resolved on the way IN, so a lookup costs one `realpath` rather than one per
    /// worktree per Session per poll.
    private var workspaces: [String: WorkspaceProjection] = [:]
    @ObservationIgnored private var polling: Task<Void, Never>?

    init(
        engine: Engine,
        repositoryURL: @escaping @MainActor () -> URL?,
        sessionCwds: @escaping @MainActor () -> [String],
    ) {
        self.engine = engine
        self.repositoryURL = repositoryURL
        self.sessionCwds = sessionCwds
    }

    /// Whether a Session running in `cwd` and last writing at `lastActivityAtMs` is live, judged
    /// against the clock of the read itself — so a roster read twice from one poll answers the same
    /// thing twice.
    func liveness(inCwd cwd: String?, lastActivityAtMs: Int?) -> SessionLiveness {
        SessionLiveness.read(
            // Both sides resolved, because they are spelled differently: `lsof` answers with the
            // symlinks already followed and a transcript reports the path its agent was launched
            // with, which under `/tmp` is never the same string.
            processMatch: cwd.map { liveCwds.contains(resolvedPath($0)) } ?? false,
            lastActivityAtMs: lastActivityAtMs,
            nowMs: readAtMs,
        )
    }

    /// What git last said about the worktree a folder is IN, or nothing where it is in none Argo
    /// read — an unread Workspace is not a clean one.
    ///
    /// The DEEPEST worktree containing the folder wins. A linked worktree under
    /// `.claude/worktrees/` sits inside the primary checkout, so the shallowest match would answer
    /// every Session in the repository with the repository's own branch.
    func workspace(inCwd cwd: String?) -> WorkspaceProjection? {
        guard let cwd,
              let path = Self.deepest(of: Array(workspaces.keys), holding: resolvedPath(cwd))
        else { return nil }
        return workspaces[path]
    }

    /// Every worktree the repository holds, as git last answered for it. The Delivery derivation's
    /// local half (#258): a branch is a Delivery whether or not a Session is on it.
    var readWorkspaces: [WorkspaceProjection] {
        workspaces.keys.sorted().compactMap { workspaces[$0] }
    }

    /// Keep reading for as long as the Hub is pointed somewhere.
    ///
    /// The first read is inside the task rather than awaited before it, so `connect` returns
    /// without waiting on a subprocess — `ps` plus an `lsof` per agent is slow enough to be felt at
    /// launch.
    func begin() async {
        await stop()
        polling = Task { [weak self] in
            while !Task.isCancelled {
                await self?.refreshLiveness()
                await self?.refreshWorkspaces()
                guard !Task.isCancelled else { return }
                try? await Task.sleep(for: WorldReadings.interval)
            }
        }
    }

    /// Ask the process table which working directories an agent is running in, and stamp the answer
    /// with the moment it was taken.
    ///
    /// The stamp is written every read, including one that found the same processes as the last:
    /// freezing the clock would leave a Session that stopped writing reading live for as long as it
    /// stayed matched.
    func refreshLiveness() async {
        let cwds = await engine.liveCwds()
        liveCwds = cwds
        readAtMs = Date().epochMs
    }

    /// Ask git which worktrees the repository holds, then what each one looks like now — one read
    /// per WORKTREE and not per Session, so four Sessions in one worktree cost one subprocess run
    /// rather than four.
    ///
    /// Scoped to the pointed Project's own repository: a Session recorded in a NESTED repository or
    /// a submodule has no Workspace here rather than one describing another repository's branch.
    ///
    /// The cancellation check keeps a Project switch from paying for the rest of a sweep it no
    /// longer wants.
    func refreshWorkspaces() async {
        // A Hub pointed nowhere is dropped rather than left holding the last Project's branches:
        // going on answering with them would be a fact about a repository nobody is on.
        guard let repositoryURL = repositoryURL() else {
            workspaces = [:]
            return
        }
        let entries = await engine.worktrees(in: repositoryURL)
        let holders = Self.holders(
            of: entries.map { resolvedPath($0.path) },
            amongst: sessionCwds().map(resolvedPath),
        )
        var read: [String: WorkspaceProjection] = [:]
        for entry in entries {
            guard !Task.isCancelled else { return }
            let path = resolvedPath(entry.path)
            read[path] = await engine.workspace(of: entry)?.shared(by: holders[path] ?? 0)
        }
        workspaces = read
    }

    /// How many Agents are in each worktree, each counted once. A linked worktree sits INSIDE the
    /// primary checkout, so a folder is credited to the deepest worktree holding it and to nothing
    /// above that — otherwise the primary would claim every Session in the repository.
    private static func holders(of paths: [String], amongst cwds: [String]) -> [String: Int] {
        cwds.reduce(into: [:]) { counts, cwd in
            guard let deepest = deepest(of: paths, holding: cwd) else { return }
            counts[deepest, default: 0] += 1
        }
    }

    /// The innermost of the worktrees holding a folder, and nothing where none of them does. Every
    /// path on both sides is already resolved — see `workspaces`.
    private static func deepest(of paths: [String], holding cwd: String) -> String? {
        paths.filter { folder($0, holds: cwd) }.max { $0.count < $1.count }
    }

    /// Whether one folder is the other or contains it, compared on a path SEPARATOR so
    /// `/repo/argo-old` is not read as living inside `/repo/argo`.
    private static func folder(_ path: String, holds cwd: String) -> Bool {
        cwd == path || cwd.hasPrefix(path.hasSuffix("/") ? path : path + "/")
    }

    /// Stop reading, and drop what was read: a branch belonging to a Project nobody is pointed at
    /// is a fact Argo no longer has.
    func stop() async {
        polling?.cancel()
        await polling?.value
        polling = nil
        liveCwds = []
        readAtMs = nil
        workspaces = [:]
    }
}

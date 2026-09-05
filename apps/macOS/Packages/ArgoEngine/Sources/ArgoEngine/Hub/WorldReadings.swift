import Foundation

/// What Argo read about the world OUTSIDE the transcripts: which working directories a live CLI was
/// running in when the process table was last read, when that read was taken, what git last said
/// about each Session's folder, and how the file system spells each of those folders.
///
/// Polled rather than watched — a process exiting writes nothing anywhere Argo could be listening
/// for it, and a symlink being repointed writes nothing either. The three reads are on the same
/// beat because all three go stale the same way.
@MainActor
@Observable
final class WorldReadings {
    /// Between reads a Session that has just exited still reads as it last did. Paid in the honest
    /// direction: the stale answer is the quieter one, and the recency window bounds it.
    static let interval = Duration.seconds(5)

    /// Not `private`: `WorldReadings+Spelling` asks it for a spelling.
    @ObservationIgnored let engine: Engine
    /// The repository to enumerate worktrees of. Supplied rather than held for the reason the
    /// folders below are: the Hub re-points, and a held URL would go on answering for the Project
    /// it was pointed at first.
    @ObservationIgnored let repositoryURL: @MainActor () -> URL?
    /// The observed Sessions. Supplied rather than held, because the answer is read off the roster
    /// and the roster is read off these readings.
    @ObservationIgnored private let sessions: @MainActor () -> [SessionActivity]

    private var liveCwds: Set<String> = []
    /// Absent until a read has happened, so an unread liveness degrades down to quiet rather than
    /// up to a running Argo never saw.
    private var readAtMs: Int?
    /// What git said about each worktree, keyed by the folder git holds it in with its symlinks
    /// already followed — every worktree the repository has, not only the ones a Session is running
    /// in (#259). Resolved on the way IN, so a lookup costs one `realpath` rather than one per
    /// worktree per Session per poll.
    private var workspaces: [String: WorkspaceProjection] = [:]
    /// The keys of `workspaces`, longest first — which is DEEPEST first, so the first one holding a
    /// folder is the one that wins. Held rather than taken per lookup: the roster asks once per
    /// Session per read, and `Array(workspaces.keys)` was allocated and scanned for each of them.
    private var deepestFirst: [String] = []
    /// How the file system spells each folder these readings answer about, keyed by the path as
    /// written. Filled by the sweep and never by a read: `realpath` is a file-system call, and no
    /// `@MainActor` type makes one (#959, ADR-0028 Rule 6).
    ///
    /// One sweep old at most. What is cached is not a Session's location — which is fixed for the
    /// life of the Session — but the resolution of a SYMLINK, and a symlink can be repointed while
    /// the app runs, so the sweep asks the whole table again rather than answering from memory.
    /// `WorldReadings+Spelling` is where that is settled.
    /// Not `private`: `WorldReadings+Spelling` spells the folders, through the publish below.
    var resolved: [String: String] = [:]
    @ObservationIgnored private var polling: Task<Void, Never>?
    /// Bumped wherever a read published here MOVED, and nowhere else — the roster's memo is keyed
    /// by it, and a write that skipped it would leave the cockpit drawing a poll it has replaced
    /// (`HubRosterMemo`). Every write to the four properties above goes through a publish below.
    private(set) var revision = 0

    init(
        engine: Engine,
        repositoryURL: @escaping @MainActor () -> URL?,
        sessions: @escaping @MainActor () -> [SessionActivity],
    ) {
        self.engine = engine
        self.repositoryURL = repositoryURL
        self.sessions = sessions
    }

    /// Whether a Session running in `cwd` and last writing at `lastActivityAtMs` is live, judged
    /// against the clock of the read itself — so a roster read twice from one poll answers the same
    /// thing twice.
    func liveness(inCwd cwd: String?, lastActivityAtMs: Int?) -> SessionLiveness {
        SessionLiveness.read(
            // Both sides spelled the same way, because they arrive spelled differently: `lsof`
            // answers with the symlinks already followed and a transcript reports the path its
            // agent was launched with, which under `/tmp` is never the same string.
            processMatch: cwd.map { liveCwds.contains(spelled($0).value) } ?? false,
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
        worktree(inCwd: cwd)?.workspace
    }

    /// The same lookup with the worktree's own FOLDER kept — which the table holds as a key and the
    /// reading above throws away. What archiving reaps by (#1398): a Workspace says a worktree is
    /// landed, and only the path says which one to remove.
    func worktree(inCwd cwd: String?) -> (path: String, workspace: WorkspaceProjection)? {
        guard let cwd else { return nil }
        let folder = spelled(cwd).value
        // Longest first, so the first match IS the deepest: two worktrees of the same path length
        // cannot both hold one folder unless they are the same worktree.
        guard let path = deepestFirst.first(where: { Self.folder($0, holds: folder) }),
              let workspace = workspaces[path]
        else { return nil }
        return (path, workspace)
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

    /// Ask the process table which working directories an agent is running in, and publish the
    /// answer with the moment it was taken — but only when publishing would change an answer.
    ///
    /// Both properties are observed, so a write re-renders every view that draws a Session. Written
    /// unconditionally they re-rendered the whole cockpit every five seconds with nothing on screen
    /// moving (#858).
    ///
    /// Freezing the stamp instead would leave a Session matched by the process table but silent
    /// past `SessionLiveness.recentActivityWindowMs` reading live for as long as it stayed matched.
    /// So the second test is the fold's ANSWER rather than its input: a poll that found the same
    /// processes still publishes where the newer clock reads some observed Session differently,
    /// which is that window crossing and nothing else.
    ///
    /// `clock` is read AFTER the process table, never before: `ps` plus an `lsof` per agent is slow
    /// enough to be felt, and the stamp is when the read landed rather than when it was asked for.
    func refreshLiveness(clock: () -> Int = { Date().epochMs }) async {
        let cwds = await engine.liveCwds()
        let observed = sessions()
        await spell(theProjectRootAnd: observed.compactMap(\.cwd), settling: .foldersNotYetSpelled)
        let read = Read(cwds: cwds, atMs: clock())
        let published = Read(cwds: liveCwds, atMs: readAtMs)
        guard publishes(read, over: published, for: observed) else { return }
        liveCwds = read.cwds
        readAtMs = read.atMs
        revision += 1
    }

    /// One poll's answer: which folders were found running an agent, and the clock it was found at.
    private struct Read {
        let cwds: Set<String>
        /// Absent only for the read nobody has taken — see `readAtMs`.
        let atMs: Int?
    }

    /// Whether a read says anything the published one does not: a moved process table, or a clock
    /// that alone reads one of these Sessions differently.
    private func publishes(
        _ read: Read,
        over published: Read,
        for sessions: [SessionActivity],
    )
        -> Bool {
        read.cwds != published.cwds
            || verdicts(of: sessions, at: read) != verdicts(of: sessions, at: published)
    }

    /// How each Session's liveness reads against one poll — the same fold `Hub.observed(_:)` runs,
    /// over the same `lastSeenAtMs`. Order is the roster's, so two folds compare position by
    /// position.
    private func verdicts(
        of sessions: [SessionActivity],
        at read: Read,
    )
        -> [SessionLiveness] {
        sessions.map { session in
            SessionLiveness.read(
                processMatch: session.cwd.map { read.cwds.contains(spelled($0).value) } ?? false,
                lastActivityAtMs: session.lastSeenAtMs,
                nowMs: read.atMs,
            )
        }
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
            publish(workspaces: [:])
            // The roster's own folders stay spelled and the gone Project's worktrees do not: the
            // table answers about folders these readings can be ASKED about, and the roster
            // survives a Hub being let go where a repository's branches do not.
            await spell(theProjectRootAnd: sessions().compactMap(\.cwd), settling: .theWholeTable)
            return
        }
        let entries = await engine.worktrees(in: repositoryURL)
        let cwds = sessions().compactMap(\.cwd)
        await spell(theProjectRootAnd: entries.map(\.path) + cwds, settling: .theWholeTable)
        let holders = Self.holders(
            of: entries.map { spelled($0.path).value },
            amongst: cwds.map { spelled($0).value },
        )
        var read: [String: WorkspaceProjection] = [:]
        for entry in entries {
            guard !Task.isCancelled else { return }
            let path = spelled(entry.path).value
            read[path] = await engine.workspace(of: entry)?.shared(by: holders[path] ?? 0)
        }
        publish(workspaces: read)
    }

    /// Written only where a spelling moved: the table is observed, so a folder spelled for the
    /// first time re-renders the row that reads it — and where the file system spelled it the same
    /// way as last time, nothing else would.
    ///
    /// Here rather than beside the rest of the spelling, so that every write to the four published
    /// readings — and so every move of `revision` — is in the one file that declares them.
    func publish(resolved table: [String: String]) {
        guard table != resolved else { return }
        resolved = table
        revision += 1
    }

    /// Written only where git answered something new. The property is observed, so a sweep that
    /// found every worktree exactly as it left it would re-render the whole cockpit (#858). The
    /// deepest-first keys are taken again here, and only here, so the lookup order can never
    /// describe a table git has replaced.
    private func publish(workspaces read: [String: WorkspaceProjection]) {
        guard read != workspaces else { return }
        workspaces = read
        deepestFirst = read.keys.sorted { $0.count > $1.count }
        revision += 1
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
        publish(workspaces: [:])
        publish(resolved: [:])
        revision += 1
    }
}

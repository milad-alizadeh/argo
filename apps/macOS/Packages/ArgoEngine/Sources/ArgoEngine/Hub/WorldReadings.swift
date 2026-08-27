import Foundation

/// What Argo read about the world OUTSIDE the transcripts: which working directories a live CLI was
/// running in when the process table was last read, when that read was taken, and what git last
/// said about each Session's folder.
///
/// Polled rather than watched — a process exiting writes nothing anywhere Argo could be listening
/// for it. Both reads are on the same beat because both go stale the same way.
///
/// The tables are private and the answers are about one folder: nothing outside needs to see them
/// as tables, and a caller holding the set could compare a launch path against a resolved one and
/// never match.
@MainActor
@Observable
final class WorldReadings {
    /// Between reads a Session that has just exited still reads as it last did. Paid in the honest
    /// direction: the stale answer is the quieter one, and the recency window bounds it.
    static let interval = Duration.seconds(5)

    @ObservationIgnored private let engine: Engine
    /// The folders to ask git about. Supplied rather than held, because the answer is read off the
    /// roster and the roster is read off these readings.
    @ObservationIgnored private let sessionCwds: @MainActor () -> [String]

    private var liveCwds: Set<String> = []
    /// Absent until a read has happened, so an unread liveness degrades down to quiet rather than
    /// up to a running Argo never saw.
    private var readAtMs: Int?
    private var workspaces: [String: WorkspaceProjection] = [:]
    @ObservationIgnored private var polling: Task<Void, Never>?

    init(engine: Engine, sessionCwds: @escaping @MainActor () -> [String]) {
        self.engine = engine
        self.sessionCwds = sessionCwds
    }

    /// Nothing has been read, or everything read has been dropped with the Project it belonged to.
    var isEmpty: Bool {
        liveCwds.isEmpty && readAtMs == nil && workspaces.isEmpty
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

    /// What git last said about one folder, or nothing where it was never asked or could not
    /// answer — an unread Workspace is not a clean one.
    func workspace(inCwd cwd: String?) -> WorkspaceProjection? {
        cwd.flatMap { workspaces[$0] }
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

    /// Ask git what each Session's working folder looks like now — one read per DISTINCT cwd, so
    /// four Sessions in one checkout cost one subprocess run rather than four.
    ///
    /// The cancellation check keeps a Project switch from paying for the rest of a sweep it no
    /// longer wants.
    func refreshWorkspaces() async {
        var read: [String: WorkspaceProjection] = [:]
        for cwd in Set(sessionCwds()) {
            guard !Task.isCancelled else { return }
            read[cwd] = await engine.workspace(at: URL(fileURLWithPath: cwd))
        }
        workspaces = read
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

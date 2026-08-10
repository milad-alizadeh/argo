import Foundation

/// Liveness is the half of a Session's status the transcript cannot carry: whether the CLI that
/// wrote it is still there. It is polled rather than watched, because a process exiting writes
/// nothing anywhere Argo could be listening for it.
@MainActor
extension Hub {
    /// Between reads a Session that has just exited still reads as it last did. That is the cost of
    /// polling, and it is paid in the honest direction: the stale answer is the quieter one for
    /// anything that has stopped, and the recency window bounds it for anything that has not.
    static let livenessInterval = Duration.seconds(5)

    /// Keep reading the process table for as long as this Hub is pointed somewhere.
    ///
    /// The first read is inside the task rather than awaited before it, so `connect` returns
    /// without waiting on a subprocess. `ps` plus an `lsof` per agent is slow enough to be felt at
    /// launch, and a window that has not come up yet is a worse answer than a roster that reads
    /// quiet for a moment longer.
    func beginLiveness() async {
        await stopLiveness()
        livenessPolling = Task { [weak self] in
            while !Task.isCancelled {
                await self?.refreshLiveness()
                // On the same beat, because both are reads of a world outside the transcript and
                // both go stale the same way. A second timer would be a second thing to stop.
                await self?.refreshWorkspaces()
                guard !Task.isCancelled else { return }
                try? await Task.sleep(for: Hub.livenessInterval)
            }
        }
    }

    /// Ask git what each Session's working folder looks like now — one read per DISTINCT cwd, so
    /// four Sessions in one checkout cost one subprocess run rather than four.
    ///
    /// It is a handful of subprocesses per poll, run one after another off the main actor, and
    /// the cancellation check is what keeps a Project switch from paying for the rest of a sweep
    /// it no longer wants. A folder git cannot answer for keeps no entry at all: the roster reads
    /// an absent Workspace as unread, which is the honest claim about a folder that has been
    /// deleted under a Session.
    func refreshWorkspaces() async {
        var read: [String: WorkspaceProjection] = [:]
        for cwd in Set(sessions.compactMap(\.cwd)) {
            guard !Task.isCancelled else { return }
            read[cwd] = await engine.workspace(at: URL(fileURLWithPath: cwd))
        }
        workspaces = read
    }

    /// Ask the process table which working directories an agent is running in, and stamp the answer
    /// with the moment it was taken — recency is judged against the read's own clock rather than a
    /// later one, so a roster read twice from one poll answers the same thing twice.
    ///
    /// The stamp is written every read, including one that found the same processes as the last:
    /// what goes stale between polls is the RECENCY half, and freezing the clock to save a redraw
    /// would leave a Session that stopped writing reading live for as long as it stayed matched.
    func refreshLiveness() async {
        let cwds = await engine.liveCwds()
        liveCwds = cwds
        livenessReadAtMs = Date().epochMs
    }

    func stopLiveness() async {
        livenessPolling?.cancel()
        await livenessPolling?.value
        livenessPolling = nil
        liveCwds = []
        livenessReadAtMs = nil
        // A branch belonging to a Project nobody is pointed at is a fact we no longer have.
        workspaces = [:]
    }

    /// One Session as the roster publishes it: what its transcript said, plus what Argo established
    /// about the process behind it and its own claim on it.
    func observed(_ session: HubSession) -> HubSession {
        var published = session
        published.liveness = SessionLiveness.read(
            // Both sides resolved, because they are spelled differently: `lsof` answers with the
            // symlinks already followed and a transcript reports the path its agent was launched
            // with, which under `/tmp` is never the same string.
            processMatch: session.cwd.map { liveCwds.contains(resolvedPath($0)) } ?? false,
            // The records' own times where they carry any, and the file's last write behind them —
            // a transcript that timestamps nothing still says when it was written to.
            lastActivityAtMs: session.lastSeenAtMs,
            nowMs: livenessReadAtMs,
        )
        published.provenance = ownership.provenance(
            cwd: session.cwd,
            startedAtMs: session.startedAtMs,
        )
        // A spawn already knows its own program; a swept record's is the store it came out of.
        published.cli = session.cli ?? discovery.cli
        published.workspace = session.cwd.flatMap { workspaces[$0] }
        // The CONVENTION tier, reached through the claim rather than the Session id: the claim is
        // what the channel is keyed by, exists before the CLI has picked an id, and outlives the
        // reconciliation that gave the Session one.
        published.convention = ownership.boundClaim(ofSessionID: session.id)
            .flatMap { companionReports[$0] }
        // The oldest waiting Permission, through the same claim: prompts are answered one at a
        // time, and the first one raised is the one the agent is blocked on.
        published.permission = ownership.boundClaim(ofSessionID: session.id)
            .flatMap { pendingPermissions[$0]?.first }
        // Read through the claim rather than published as it was recorded: the fresh row is
        // re-keyed to its CLI's own id the moment its record appears, and the link has to follow it
        // there.
        published.handedOffTo = followableHandoffs[session.id].map(ownership.rowID(ofClaim:))
        return published
    }
}

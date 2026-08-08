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

    /// Take one read now, then keep taking them for as long as this Hub is pointed somewhere.
    func beginLiveness() async {
        await stopLiveness()
        await refreshLiveness()
        livenessPolling = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: Hub.livenessInterval)
                guard !Task.isCancelled else { return }
                await self?.refreshLiveness()
            }
        }
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
        livenessReadAtMs = Int(Date().timeIntervalSince1970 * 1000)
    }

    func stopLiveness() async {
        livenessPolling?.cancel()
        await livenessPolling?.value
        livenessPolling = nil
        liveCwds = []
        livenessReadAtMs = 0
    }

    /// One Session as the roster publishes it: what its transcript said, plus what Argo established
    /// about the process behind it and its own claim on it.
    func observed(_ session: HubSession) -> HubSession {
        var published = session
        published.liveness = SessionLiveness.read(
            processMatch: session.cwd.map(liveCwds.contains) ?? false,
            // The records' own times where they carry any, and the file's last write behind them —
            // a transcript that timestamps nothing still says when it was written to.
            lastActivityAtMs: session.lastSeenAtMs,
            nowMs: livenessReadAtMs,
        )
        published.provenance = ownership.provenance(
            cwd: session.cwd,
            startedAtMs: session.startedAtMs,
        )
        return published
    }
}

import Foundation

/// Discovery moves the working set while the app runs: the sweep says which transcripts belong to
/// the Project right now, and the Hub's tails are moved onto that answer.
@MainActor
extension Hub {
    /// Sweep once, then keep sweeping as the record directory changes — which is what makes a
    /// Session started after launch appear without a relaunch.
    ///
    /// Any sweep already running is ended first. `connect` suspends twice before reaching here, so
    /// two of them can interleave; overwriting the task rather than ending it would leave the first
    /// loop sweeping for the process's lifetime, against a Project nobody is looking at.
    func beginDiscovery() async {
        await stopSweeping()
        // Captured rather than re-read on every sweep: `project` follows the checkout, and a sweep
        // is for the Project it was begun for until it is ended.
        sweepProjectURL = project.url
        await refreshWorkingSet()
        sweeping = Task { [weak self] in
            guard let changes = self?.discovery.changes() else { return }
            for await _ in changes {
                await self?.refreshWorkingSet()
            }
        }
    }

    /// Re-run the sweep and move the tails onto its answer: a transcript recorded since the last
    /// one starts being tailed, and one that has aged out of the window stops — keeping its row,
    /// because it is the descriptors that are bounded and not the roster.
    func refreshWorkingSet() async {
        guard let sweepProjectURL else { return }
        let wanted = await discovery.workingSet(for: sweepProjectURL)
        // Re-read after the await: the sweep runs off the main actor, and a `disconnect` in the
        // meantime means these tails belong to a Project nobody is pointed at any more.
        guard self.sweepProjectURL != nil else { return }
        let wantedIDs = Set(wanted.map(\.path))
        for transcriptID in observedTranscriptIDs where !wantedIDs.contains(transcriptID) {
            await pauseObserving(transcriptID: transcriptID)
        }
        for url in wanted where !isObserving(transcriptID: url.path) {
            // A file the sweep saw a moment ago can be gone by the time it is opened. Skipping it
            // is the honest answer: nobody named this file, and the next sweep sees it again if it
            // comes back — where a named transcript that cannot be read is a failed connection.
            guard let observation = try? engine.observeTranscript(at: url) else { continue }
            await startTailing(observation)
        }
        // Every sweep, not only the ones that moved a tail: a fan-out's files appear beside a
        // transcript that is already in the working set, so nothing above would notice them.
        refreshSubagents()
    }

    /// End the sweep before the tails it feeds are torn down, and await it: a sweep still running
    /// would otherwise re-register a transcript of the Project being dropped.
    func stopSweeping() async {
        sweepProjectURL = nil
        sweeping?.cancel()
        await sweeping?.value
        sweeping = nil
    }
}

import Foundation

/// Discovery moves the working set while the app runs: the sweep says which transcripts belong to
/// the Project right now, and the Hub's tails are moved onto that answer.
@MainActor
extension Hub {
    /// Sweep once, then keep sweeping as the record directory changes — which is what makes a
    /// Session started after launch appear without a relaunch.
    func beginDiscovery(for projectURL: URL, using engine: Engine) async {
        sweep = HubSweep(engine: engine, projectURL: projectURL)
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
        guard let sweep else { return }
        let wanted = discovery.workingSet(for: sweep.projectURL)
        let wantedIDs = Set(wanted.map(\.path))
        for transcriptID in observedTranscriptIDs where !wantedIDs.contains(transcriptID) {
            await pauseObserving(transcriptID: transcriptID)
        }
        for url in wanted where !isObserving(transcriptID: url.path) {
            // A file the sweep saw a moment ago can be gone by the time it is opened. Skipping it
            // is the honest answer: nobody named this file, and the next sweep sees it again if it
            // comes back — where a named transcript that cannot be read is a failed connection.
            guard let observation = try? sweep.engine.observeTranscript(at: url) else { continue }
            await startObserving(observation)
        }
    }

    /// End the sweep before the tails it feeds are torn down, and await it: a sweep still running
    /// would otherwise re-register a transcript of the Project being dropped.
    func stopSweeping() async {
        sweep = nil
        sweeping?.cancel()
        await sweeping?.value
        sweeping = nil
    }
}

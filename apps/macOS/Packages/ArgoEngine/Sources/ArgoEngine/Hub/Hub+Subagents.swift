import Foundation

/// One tailed Subagent file: whose Session it was read for, and which file it is. Both halves are
/// the key — a Session has as many files as it delegated, and one file can be read for only one.
struct SubagentTail: Hashable {
    let transcriptID: String
    let path: String
}

/// A Session's Subagents, tailed beside its own record (#711).
///
/// Tailed rather than read once, and re-discovered rather than found once: a fan-out's files appear
/// WHILE the parent runs — the file for a delegation just handed over does not exist yet — and they
/// go on growing after the parent has fallen quiet. Discovery rides the sweep that moves the
/// working set, so it runs whenever the CLI's record root changes.
@MainActor
extension Hub {
    /// A tail for every Subagent file beside every transcript that is still being TAILED.
    ///
    /// Not every transcript in the join: one that has aged out of the working set keeps its row and
    /// loses its tail, and reading its children would put back the descriptors that pause just
    /// released — every sweep, for as long as the row stood.
    func refreshSubagents() {
        for transcript in join.transcripts where isObserving(transcriptID: transcript.id) {
            refreshSubagents(of: transcript.id, beside: transcript.sourceURL)
        }
    }

    /// The same for one transcript. Re-entrant: a file already tailed is left alone, which is what
    /// makes this safe to run on every sweep — re-tailing would re-read the file from the top and
    /// apply everything in it a second time.
    func refreshSubagents(of transcriptID: String, beside parentURL: URL) {
        for found in engine.subagents(beside: parentURL) {
            let tail = SubagentTail(transcriptID: transcriptID, path: found.url.path)
            guard subagentTails[tail] == nil else { continue }
            let observation = engine.observeSubagent(found)
            subagentTails[tail] = Task { [weak self] in
                await self?.drain(observation, of: transcriptID)
            }
        }
    }

    /// Stop every Subagent tail read for one transcript. Called wherever the parent's own tail
    /// stops: a child read for a Session nobody reads is two descriptors held open for nothing.
    ///
    /// The rows stay, for the reason a paused transcript's row stays — it is the descriptors that
    /// are bounded, not the reading.
    func stopTailingSubagents(of transcriptID: String) async {
        await stopTailingSubagents { $0.transcriptID == transcriptID }
    }

    func stopTailingAllSubagents() async {
        await stopTailingSubagents { _ in true }
    }

    /// Cancelling the whole set before awaiting any of it keeps a slow teardown from serialising
    /// behind the one in front of it — the same shape, and the same reason, as `stopObservingAll`.
    private func stopTailingSubagents(_ isStopping: (SubagentTail) -> Bool) async {
        let stopped = subagentTails.filter { isStopping($0.key) }
        for tail in stopped.keys {
            subagentTails.removeValue(forKey: tail)
        }
        for task in stopped.values {
            task.cancel()
        }
        for task in stopped.values {
            await task.value
        }
    }

    private func drain(_ observation: SubagentObservation, of transcriptID: String) async {
        for await events in observation.events {
            join.apply(events, ofSubagent: observation.agentID, to: transcriptID)
        }
    }
}

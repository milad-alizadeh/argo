import Foundation

/// One tailed Subagent file: whose Session it was read for, and which file it is. Both halves are
/// the key — a Session has as many files as it delegated, and one file can be read for only one.
struct SubagentTail: Hashable {
    let transcriptID: String
    let path: String
}

/// One read from a Subagent's file: what it said, whose file it was, and which Session delegated
/// it. A value, because two adjacent `String` arguments transpose without the compiler noticing.
struct SubagentRead {
    let events: [TranscriptEvent]
    let agentID: String
    let transcriptID: String
}

/// A Session's Subagents, tailed beside its own record (#711).
///
/// Tailed rather than read once, and re-discovered rather than found once: a fan-out's files appear
/// WHILE the parent runs — the file for a delegation just handed over does not exist yet — and they
/// go on growing after the parent has fallen quiet. Discovery rides the sweep that moves the
/// working set, so it runs whenever the CLI's record root changes.
///
/// A table of its own: a Subagent is not in the working set and has no row.
@MainActor
final class SubagentTails {
    private let engine: Engine
    /// Where a batch goes once read. The join is the watch's, and a Subagent's events land in it
    /// under the id of the Session that delegated them.
    private let apply: @MainActor (SubagentRead) -> Void

    private var tails: [SubagentTail: Task<Void, Never>] = [:]

    init(
        engine: Engine,
        apply: @escaping @MainActor (SubagentRead) -> Void,
    ) {
        self.engine = engine
        self.apply = apply
    }

    /// A tail for every Subagent file beside one transcript. Re-entrant: a file already tailed is
    /// left alone, which is what makes this safe to run on every sweep — re-tailing would re-read
    /// the file from the top and apply everything in it a second time.
    func refresh(of transcriptID: String, beside parentURL: URL) {
        for found in engine.subagents(beside: parentURL) {
            let tail = SubagentTail(transcriptID: transcriptID, path: found.url.path)
            guard tails[tail] == nil else { continue }
            let observation = engine.observeSubagent(found)
            tails[tail] = Task { [weak self] in
                await self?.drain(observation, of: transcriptID)
            }
        }
    }

    /// Stop every Subagent tail read for one transcript. Called wherever the parent's own tail
    /// stops: a child read for a Session nobody reads is two descriptors held open for nothing.
    ///
    /// The rows stay, for the reason a paused transcript's row stays — it is the descriptors that
    /// are bounded, not the reading.
    func stop(of transcriptID: String) async {
        await stop { $0.transcriptID == transcriptID }
    }

    func stopAll() async {
        await stop { _ in true }
    }

    /// Cancelling the whole set before awaiting any of it keeps a slow teardown from serialising
    /// behind the one in front of it.
    private func stop(_ isStopping: (SubagentTail) -> Bool) async {
        let stopped = tails.filter { isStopping($0.key) }
        for tail in stopped.keys {
            tails.removeValue(forKey: tail)
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
            apply(SubagentRead(
                events: events,
                agentID: observation.agentID,
                transcriptID: transcriptID,
            ))
        }
    }
}

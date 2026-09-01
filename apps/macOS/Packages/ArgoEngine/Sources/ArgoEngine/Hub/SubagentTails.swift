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
///
/// A table of its own: a Subagent is not in the working set and has no row.
@MainActor
final class SubagentTails {
    private let engine: Engine
    /// Where a batch goes once read. Beside the roster rather than inside it, which is the whole
    /// point of the store — see `SubagentReadings`.
    private let readings: SubagentReadings

    private var tails: [SubagentTail: Task<Void, Never>] = [:]
    /// Which Agent each tailed file is being read for. NOT cleared when a tail is paused: a paused
    /// transcript keeps its readings, and a table emptied here would leave the drop that follows
    /// with nothing to name — readings nobody could reach and nobody would free.
    private var agentsByTail: [SubagentTail: String] = [:]

    init(engine: Engine, readings: SubagentReadings) {
        self.engine = engine
        self.readings = readings
    }

    /// A tail for every Subagent file beside one transcript. Re-entrant: a file already tailed is
    /// left alone, which is what makes this safe to run on every sweep — re-tailing would re-read
    /// the file from the top and apply everything in it a second time.
    func refresh(of transcriptID: String, beside parentURL: URL) {
        for found in engine.subagents(beside: parentURL) {
            let tail = SubagentTail(transcriptID: transcriptID, path: found.url.path)
            guard tails[tail] == nil else { continue }
            let observation = engine.observeSubagent(found)
            agentsByTail[tail] = observation.agentID
            readings.beginReading(of: observation.agentID, from: tail.path)
            tails[tail] = Task { [weak self] in
                await self?.drain(observation, from: tail.path)
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

    /// Which Agent each of one transcript's files was read for, given up as it is answered — the
    /// one caller drops the transcript, and what it does with these is forget their readings.
    /// Named by FILE as well as by id, so the half of a moved transcript that goes cannot take the
    /// live half's reading with it.
    func surrenderClaims(of transcriptID: String) -> [String: String] {
        let surrendered = agentsByTail.filter { $0.key.transcriptID == transcriptID }
        for tail in surrendered.keys {
            agentsByTail.removeValue(forKey: tail)
        }
        return surrendered.reduce(into: [:]) { claims, tail in
            claims[tail.value] = tail.key.path
        }
    }

    func stopAll() async {
        agentsByTail = [:]
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

    private func drain(_ observation: SubagentObservation, from path: String) async {
        for await events in observation.events {
            readings.apply(events, from: path)
        }
    }
}

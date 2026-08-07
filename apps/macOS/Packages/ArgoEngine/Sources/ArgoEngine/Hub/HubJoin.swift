import Foundation

/// The rebuildable projection over the observed working set: which transcripts are in it, which
/// transcript owns each record, and the Sessions those two facts stitch into.
///
/// A value with no tasks in it, so dropping a whole Project's worth is `HubJoin()` — there is no
/// half-cleared state for a straggling event to land in.
struct HubJoin {
    /// Rebuilt on mutation rather than on read: the roster is read once per view update and
    /// written once per transcript event, and only the write side knows when it changed.
    private(set) var sessions: [HubSession] = []

    /// In the order they joined the set, which is the order the observation projection renders and
    /// the one record ownership is resolved by.
    private(set) var transcripts: [HubTranscript] = []
    /// Record uuid → the id of the transcript that owns it. Keyed by id rather than by position,
    /// because dropping one transcript renumbers every position after it and would silently
    /// re-point owners at a neighbour.
    private var recordOwners: [String: String] = [:]

    mutating func add(_ observation: TranscriptObservation) {
        guard !transcripts.contains(where: { $0.id == observation.id }) else { return }
        transcripts.append(HubTranscript(observation: observation))
        rebuild()
    }

    mutating func remove(transcriptID: String) {
        transcripts.removeAll { $0.id == transcriptID }
        recordOwners = recordOwners.filter { $0.value != transcriptID }
        rebuild()
    }

    /// An event for a transcript no longer in the set applies nothing, which is what makes dropping
    /// a Project safe against a tail still tearing down: the join it would write into is gone
    /// before its cancellation is even asked for.
    mutating func apply(_ event: TranscriptEvent, to transcriptID: String) {
        guard let index = position(of: transcriptID) else { return }
        transcripts[index].session.apply(event)
        if case let .recordIdentity(uuid) = event {
            rememberOwner(of: uuid, transcriptID: transcriptID)
        }
        rebuild()
    }

    /// The earliest transcript to claim a record keeps it: a resume chain is walked from its root,
    /// and a later file re-reporting an inherited record is not its author.
    private mutating func rememberOwner(of uuid: String, transcriptID: String) {
        guard let claimant = position(of: transcriptID) else { return }
        if let holder = recordOwners[uuid], let held = position(of: holder), held <= claimant {
            return
        }
        recordOwners[uuid] = transcriptID
    }

    private func position(of transcriptID: String) -> Int? {
        transcripts.firstIndex { $0.id == transcriptID }
    }

    private mutating func rebuild() {
        sessions = HubSessionChain.sessions(from: transcripts, owners: recordOwners)
    }
}

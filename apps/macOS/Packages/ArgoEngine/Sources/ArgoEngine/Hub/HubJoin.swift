import Foundation

/// The rebuildable projection over the observed working set: which transcripts are in it, which
/// transcript owns each record, and the Sessions those two facts stitch into. A value with no tasks
/// in it, so dropping a whole Project's worth is `HubJoin()`.
struct HubJoin {
    /// Rebuilt on mutation rather than on read: only the write side knows when it changed.
    private(set) var sessions: [HubSession] = []

    /// In the order they joined the set, which is the order the observation projection renders and
    /// the one record ownership is resolved by.
    private(set) var transcripts: [HubTranscript] = []
    /// Record uuid → the id of the transcript that owns it. Keyed by id and not by position:
    /// dropping one transcript renumbers every position after it.
    private var recordOwners: [String: String] = [:]

    var isEmpty: Bool {
        transcripts.isEmpty
    }

    /// Admit a transcript to the working set, unsettled — present for the records it is about to
    /// claim, absent from the roster until its file has been read. Re-adding one already here
    /// changes nothing.
    mutating func add(_ observation: TranscriptObservation) {
        guard !transcripts.contains(where: { $0.id == observation.id }) else { return }
        transcripts.append(HubTranscript(observation: observation))
    }

    mutating func remove(transcriptID: String) {
        transcripts.removeAll { $0.id == transcriptID }
        recordOwners = recordOwners.filter { $0.value != transcriptID }
        rebuild()
    }

    /// Apply one read's worth of events, rebuilding once for the batch rather than once per event.
    /// Applying also SETTLES the transcript: the first batch a tail delivers is the backfill of
    /// what its file already held. A batch for a transcript no longer in the set applies nothing.
    mutating func apply(_ events: [TranscriptEvent], to transcriptID: String) {
        guard let index = position(of: transcriptID) else { return }
        for event in events {
            transcripts[index].session.apply(event)
            if case let .recordIdentity(uuid) = event {
                rememberOwner(of: uuid, transcriptID: transcriptID)
            }
        }
        transcripts[index].isSettled = true
        rebuild()
    }

    /// Settle a transcript whose tail ended without ever delivering a backfill — a file that could
    /// not be opened, or a tail stopped mid-read. Without it the roster waits forever.
    mutating func settle(transcriptID: String) {
        guard let index = position(of: transcriptID), !transcripts[index].isSettled else { return }
        apply([], to: transcriptID)
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

    /// Published only once every transcript in the set has settled. While a sweep admits a new
    /// transcript the last published roster stands: briefly missing a row, never rewriting itself
    /// under the reader.
    private mutating func rebuild() {
        guard transcripts.allSatisfy(\.isSettled) else { return }
        sessions = HubSessionChain.sessions(from: transcripts, owners: recordOwners)
    }
}

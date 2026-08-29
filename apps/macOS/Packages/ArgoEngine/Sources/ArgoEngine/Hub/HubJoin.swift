import Foundation

/// The rebuildable projection over the observed working set: which transcripts are in it, which
/// transcript owns each record, and the Sessions those two facts stitch into. A value with no tasks
/// in it, so dropping a whole Project's worth is `HubJoin()`.
struct HubJoin {
    /// Rebuilt on mutation rather than on read: only the write side knows when it changed. A
    /// Subagent's batch is written into it in place instead — see `apply(_:ofSubagent:to:)`.
    private var roster = HubRoster()
    var sessions: [HubSession] {
        roster.sessions
    }

    /// In the order they joined the set, which is the order the observation projection renders and
    /// the one record ownership is resolved by.
    private(set) var transcripts: [HubTranscript] = []
    /// Record uuid → the id of the transcript that owns it. Keyed by id and not by position:
    /// dropping one transcript renumbers every position after it.
    private var recordOwners: [String: String] = [:]
    /// Transcript id to its position in `transcripts`. Held rather than scanned for: a Subagent's
    /// tail asks this on every batch it delivers.
    private var positions: [String: Int] = [:]

    var isEmpty: Bool {
        transcripts.isEmpty
    }

    /// Admit a transcript to the working set, unsettled — present for the records it is about to
    /// claim, absent from the roster until its file has been read. Re-adding one already here
    /// changes nothing.
    mutating func add(_ observation: TranscriptObservation) {
        guard positions[observation.id] == nil else { return }
        positions[observation.id] = transcripts.count
        transcripts.append(HubTranscript(observation: observation))
    }

    mutating func remove(transcriptID: String) {
        transcripts.removeAll { $0.id == transcriptID }
        // Every position after the one dropped has moved, so the table is taken again rather than
        // patched — a removal is a sweep's answer, not something a tail does.
        positions = Dictionary(uniqueKeysWithValues: transcripts.enumerated().map { ($1.id, $0) })
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

    /// One Subagent's own reading, applied to the Session that ran it.
    ///
    /// It does NOT settle the transcript, unlike the Session's own events: a child's file says
    /// nothing about whether the parent's has been read, and settling on one would publish a roster
    /// row for a Session whose own backfill has not landed.
    ///
    /// A read carrying nothing applies nothing, so a file that exists and has said nothing yet is a
    /// Subagent with no reading rather than one with an empty reading — degrade-down, and what
    /// keeps
    /// its chip quiet instead of making it a control that empties the feed.
    mutating func apply(
        _ read: [TranscriptEvent],
        ofSubagent agentID: String,
        to transcriptID: String,
    ) {
        guard !read.isEmpty, let index = position(of: transcriptID) else { return }
        transcripts[index].session.apply(read, ofSubagent: agentID)
        // Onto that Session's published row and nothing else: a child's bytes join no chain and
        // move no sort key, so rebuilding the roster for them is work with a scope its cause does
        // not have (ADR-0028 Rule 1). A transcript the roster was published without reaches
        // nothing here, and its reading arrives with the rebuild that publishes it.
        roster.apply(read, ofSubagent: agentID, from: transcriptID)
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
        positions[transcriptID]
    }

    /// Published only once every transcript in the set has settled. While a sweep admits a new
    /// transcript the last published roster stands: briefly missing a row, never rewriting itself
    /// under the reader.
    private mutating func rebuild() {
        guard transcripts.allSatisfy(\.isSettled) else { return }
        roster = HubSessionChain.roster(from: transcripts, owners: recordOwners)
    }
}

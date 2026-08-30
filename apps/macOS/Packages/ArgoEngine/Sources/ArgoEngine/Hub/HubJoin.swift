import Foundation

/// The rebuildable projection over the observed working set: which transcripts are in it, which
/// transcript owns each record, and the Sessions those two facts stitch into. A value with no tasks
/// in it, so dropping a whole Project's worth is `HubJoin()`.
struct HubJoin {
    /// Rebuilt on mutation rather than on read: only the write side knows when it changed.
    private var roster = HubRoster()
    /// Whether the roster is still in the order a fold left it in. A batch written in place moves
    /// its row's sort key without moving the row, so the order is restored on READ instead — the
    /// same comparator, over the same rows, which is the same answer a refold would have given.
    private var isOrdered = true
    var sessions: [HubSession] {
        isOrdered ? roster.sessions : HubSessionChain.ordered(roster.sessions)
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
    /// The uuids the transcripts in the set resume FROM. Held so a batch can ask in O(batch)
    /// whether the record identities it claimed can have re-parented anything: the chain graph
    /// reads record ownership through `headLeafUUID` alone, so a claim on any other uuid is
    /// invisible to it. Retaken by every fold, and a `headLeafUUID` that moves forces one.
    private var chainKeys: Set<String> = []

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
        // The set has moved and nothing has refolded the roster — this transcript can be a chain's
        // new link or the second path onto one uuid, and which of those it is nobody knows until
        // its file has been read.
        roster.holdWrites()
    }

    mutating func remove(transcriptID: String) {
        transcripts.removeAll { $0.id == transcriptID }
        // Every position after the one dropped has moved, so the table is taken again whole.
        positions = Dictionary(transcripts.enumerated().map { ($1.id, $0) }) { first, _ in first }
        recordOwners = recordOwners.filter { $0.value != transcriptID }
        rebuild()
    }

    /// Apply one read's worth of events, rebuilding once for the batch rather than once per event.
    /// Applying also SETTLES the transcript: the first batch a tail delivers is the backfill of
    /// what its file already held. A batch for a transcript no longer in the set applies nothing.
    mutating func apply(_ events: [TranscriptEvent], to transcriptID: String) {
        guard let index = position(of: transcriptID) else { return }
        let before = HubJoinFacts(of: transcripts[index].session)
        // A backfill is a transcript joining the published set, which is a move of the set itself.
        var moved = !transcripts[index].isSettled
        for event in events {
            transcripts[index].session.apply(event)
            if case let .recordIdentity(uuid) = event {
                moved = rememberOwner(of: uuid, transcriptID: transcriptID) || moved
            }
        }
        transcripts[index].isSettled = true
        moved = moved || HubJoinFacts(of: transcripts[index].session) != before
        // Written THROUGH for the same reason the Subagent path is, and under a stricter test: the
        // row must BE this transcript, so the whole Session replaces the row and no merge is
        // reproduced by hand. Anything else — a chain, a duplicated uuid, a held roster — refolds.
        guard !moved, roster.replace(transcripts[index].session, from: transcriptID) else {
            rebuild()
            return
        }
        isOrdered = false
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
        // Written THROUGH, to the transcript above and the published row here: the roster is a
        // fold over the transcripts rather than a second copy of them, so a batch that reached
        // only one of the two would be lost at the next rebuild or published twice by it. The
        // transcript is the copy that keeps it; the roster takes it only where it can place it.
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
    ///
    /// Answers whether the claim can have moved the graph, which is only where the uuid is one
    /// some transcript resumes FROM.
    private mutating func rememberOwner(of uuid: String, transcriptID: String) -> Bool {
        guard let claimant = position(of: transcriptID) else { return false }
        if let holder = recordOwners[uuid], let held = position(of: holder), held <= claimant {
            return false
        }
        recordOwners[uuid] = transcriptID
        return chainKeys.contains(uuid)
    }

    private func position(of transcriptID: String) -> Int? {
        positions[transcriptID]
    }

    /// Published only once every transcript in the set has settled. While a sweep admits a new
    /// transcript the roster keeps the rows it has, in the order it has them: briefly missing a
    /// row, never rewriting itself under the reader. Nothing is written into it in place while it
    /// is held back either — see `HubRoster.holdWrites`.
    private mutating func rebuild() {
        chainKeys = Set(transcripts.compactMap(\.session.headLeafUUID))
        isOrdered = true
        guard transcripts.allSatisfy(\.isSettled) else {
            // Held back, so the facts have moved and the fold has not: the same staleness `add`
            // opens, reached by the other path into it.
            roster.holdWrites()
            return
        }
        roster = HubSessionChain.roster(from: transcripts, owners: recordOwners)
    }
}

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

    #if DEBUG
        /// How many whole-set rebuilds this join paid, counted rather than timed (ADR-0028 Rule
        /// 8). Per value, because a static one would be shared by every suite running beside this.
        private(set) var rebuilds = 0
    #endif

    var isEmpty: Bool {
        transcripts.isEmpty
    }

    /// Every transcript folded into the row under this id, the row's own first.
    ///
    /// A row is a resume CHAIN (`CONTEXT.md` L2), so reading one Session whole means reading every
    /// link of it: draining the root alone would leave the NEWEST half of the reading — the half
    /// the feed opens on — still an excerpt.
    func chainedTranscriptIDs(of rowID: String) -> [String] {
        guard let row = transcripts.first(where: { $0.id == rowID }) else { return [] }
        var claimed: Set<String> = [row.sessionID]
        let graph = HubChainGraph(transcripts: transcripts, owners: recordOwners)
        let chain = Set([row.sessionID] + graph.claimContinuations(
            of: row.sessionID,
            into: &claimed,
        ))
        return transcripts.filter { chain.contains($0.sessionID) }.map(\.id)
    }

    /// How many events each transcript's reading holds — what `WholeReadings` bounds itself by.
    func eventsHeld() -> [String: Int] {
        Dictionary(transcripts.map { ($0.id, $0.session.events.count) }) { first, _ in first }
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

    /// Read one transcript again from the beginning, keeping its place in the set and the row it
    /// already has.
    ///
    /// What selecting a Session takes: the sweep admitted it on a BOUNDED reading of its two ends,
    /// and the feed needs the whole file (`TranscriptExcerpt`). The first reading is dropped rather
    /// than added to, so nothing it saw is counted twice — and the row on screen stands, stale
    /// rather than absent, until the new one settles.
    mutating func reread(_ observation: TranscriptObservation) {
        guard let index = position(of: observation.id) else { return }
        transcripts[index] = HubTranscript(observation: observation)
        // The reading under one row has been thrown away and no fold has been retaken: the same
        // staleness `add` opens, reached by a third path into it.
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

    /// Folded over the transcripts that have been READ, which is the whole set once a sweep has
    /// finished and a prefix of it while one is running (`HubJoinPublishable`). A row not folded
    /// yet is missing; a row already folded keeps its place and its order, because the comparator
    /// and the keys are the same ones that put it there.
    ///
    /// While the fold is partial nothing may be written into the roster in place either — see
    /// `HubRoster.holdWrites`, whose every rejection is a fact about the whole set.
    private mutating func rebuild() {
        #if DEBUG
            rebuilds += 1
        #endif
        chainKeys = Set(transcripts.compactMap(\.session.headLeafUUID))
        isOrdered = true
        let publishable = HubJoinPublishable(of: transcripts, owners: recordOwners)
        roster = HubSessionChain.roster(from: publishable.transcripts, owners: recordOwners)
        guard !publishable.isComplete else { return }
        roster.holdWrites()
    }
}

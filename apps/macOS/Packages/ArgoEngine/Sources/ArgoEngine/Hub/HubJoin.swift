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
    /// The transcript ids the last fold published. What the next fold keeps published, so a row
    /// that has stood on the roster is never taken away by a sweep (`HubJoinPublishable`).
    private var standing: Set<String> = []

    #if DEBUG
        /// How many whole-set rebuilds this join paid, counted rather than timed (ADR-0028 Rule
        /// 8). Per value, because a static one would be shared by every suite running beside this.
        private(set) var rebuilds = 0
        /// The most events any ONE write folded into this join — what bounds how long a single
        /// write can hold the main actor (`TranscriptSlice`). Counted for `rebuilds`' reason.
        private(set) var largestFold = 0
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

    /// Whether this transcript is already in the set — under any reading, settled or not.
    ///
    /// What a re-tail asks before it admits one: a tail reads its file from the first byte, so a
    /// transcript coming back to the set is being read AGAIN and takes `reread` below rather than
    /// `add` (#1213).
    func holds(transcriptID: String) -> Bool {
        position(of: transcriptID) != nil
    }

    /// Admit a transcript to the working set, unsettled — present for the records it is about to
    /// claim, absent from the roster until its file has been read. Re-adding one already here
    /// changes nothing, and is not how a transcript is read again: see `holds` and `reread`.
    ///
    /// Answers whether anything MOVED, which is what `TranscriptWatch.mutate` publishes on (#858).
    /// The four writes a test drives directly carry `@discardableResult`; the two that exist only
    /// for that answer do not, so the compiler holds them.
    @discardableResult
    mutating func add(_ observation: TranscriptObservation) -> Bool {
        guard !holds(transcriptID: observation.id) else { return false }
        positions[observation.id] = transcripts.count
        transcripts.append(HubTranscript(observation: observation))
        // The set has moved and nothing has refolded the roster — this transcript can be a chain's
        // new link or the second path onto one uuid, and which of those it is nobody knows until
        // its file has been read.
        roster.holdWrites()
        return true
    }

    /// Read one transcript again from the beginning, keeping its place in the set and the row it
    /// already has.
    ///
    /// What selecting a Session takes: the sweep admitted it on a BOUNDED reading of its two ends,
    /// and the feed needs the whole file (`TranscriptExcerpt`). The first reading is dropped rather
    /// than added to, so nothing it saw is counted twice — and the row on screen stands, stale
    /// rather than absent, until the new one settles.
    ///
    /// Stands through OTHER transcripts' batches too: the transcript stays settled with its stale
    /// reading in the fold, and only its own batch swaps the reading (`HubTranscript.beginBatch`).
    /// Nothing published moves, so this answers `false` (#858, #1134).
    mutating func reread(_ observation: TranscriptObservation) -> Bool {
        guard let index = position(of: observation.id) else { return false }
        transcripts[index].reread(observation)
        return false
    }

    /// Take a whole join in place of this one — a Project repointed onto its retained join, or a
    /// teardown emptying it. Two EMPTY joins are the same join, so a repoint with nothing retained
    /// for the Project publishes no roster.
    mutating func replace(with fresh: HubJoin) -> Bool {
        let moved = !isEmpty || !fresh.isEmpty
        self = fresh
        return moved
    }

    /// Drop one transcript's row. A transcript the set never held drops nothing.
    @discardableResult
    mutating func remove(transcriptID: String) -> Bool {
        guard position(of: transcriptID) != nil else { return false }
        transcripts.removeAll { $0.id == transcriptID }
        // Every position after the one dropped has moved, so the table is taken again whole.
        positions = Dictionary(transcripts.enumerated().map { ($1.id, $0) }) { first, _ in first }
        recordOwners = recordOwners.filter { $0.value != transcriptID }
        rebuild()
        return true
    }

    /// Fold one slice of a read into the transcript's reading, publishing NOTHING.
    ///
    /// What a read longer than `TranscriptSlice.events` lands in, so no single write holds the main
    /// actor for the length of a file (#1166). The row on screen stands on the reading it already
    /// had — the stale one while a transcript is read again, and no row at all while a transcript
    /// is read for the first time — until `apply` below closes the read and publishes the whole of
    /// it at once. A slice for a transcript no longer in the set folds nothing.
    ///
    /// Always answers `false`: nothing published moved, which is exactly the claim (#858, #1134).
    /// The records it claims are claimed as they are folded, because ownership is resolved by which
    /// transcript claimed a record FIRST and a slice held back would put this file behind a tail
    /// that started after it.
    mutating func stage(_ events: [TranscriptEvent], to transcriptID: String) -> Bool {
        guard let index = position(of: transcriptID), !events.isEmpty else { return false }
        countFold(of: events)
        transcripts[index].stage(events)
        for event in events {
            guard case let .recordIdentity(uuid) = event else { continue }
            _ = rememberOwner(of: uuid, transcriptID: transcriptID)
        }
        return false
    }

    /// Apply one read's worth of events, rebuilding once for the batch rather than once per event.
    /// Applying also SETTLES the transcript: the first batch a tail delivers is the backfill of
    /// what its file already held. A batch for a transcript no longer in the set applies nothing.
    ///
    /// It is also what CLOSES a read that landed in slices (`stage`), publishing every one of them
    /// under this one write — so a batch longer than `TranscriptSlice.events` reaches the roster in
    /// exactly the state it would have reached it in whole.
    @discardableResult
    mutating func apply(_ events: [TranscriptEvent], to transcriptID: String) -> Bool {
        guard let index = position(of: transcriptID) else { return false }
        countFold(of: events)
        // A backfill is a transcript joining the published set, which is a move of the set itself.
        // A reread's backfill replaces a row already in it and is a move of that row.
        var moved = !transcripts[index].isSettled
        moved = transcripts[index].beginBatch() || moved
        // A read that landed in slices publishes here, whatever its LAST slice held: the events
        // before it are already in the reading and nothing has been published for them yet.
        moved = transcripts[index].takeStaged() || moved
        let before = HubJoinFacts(of: transcripts[index].session)
        // Nothing in the batch and the transcript already settled: no event to append and no
        // record to claim, so no row moves. Every tail that ENDS takes this path (#858). A batch
        // with events in it always moves one, folded fact or not — the stream's stamp is what the
        // cockpit compares two readings by, and an event moves that.
        guard !events.isEmpty || moved else { return false }
        for event in events {
            transcripts[index].applyToCurrent(event)
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
            return true
        }
        isOrdered = false
        return true
    }

    /// Settle a transcript whose tail ended without ever delivering a backfill — a file that could
    /// not be opened, or a tail stopped mid-read. Without it the roster waits forever.
    ///
    /// A reread whose tail ended the same way keeps the stale reading it was standing on — an
    /// empty reading in its place would be the vanishing row `reread` refuses.
    @discardableResult
    mutating func settle(transcriptID: String) -> Bool {
        guard let index = position(of: transcriptID) else { return false }
        if transcripts[index].isSettled {
            transcripts[index].abandonReread()
            return false
        }
        return apply([], to: transcriptID)
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

    /// Record how much one write folded, which is what `TranscriptSlice` bounds. Spelled once and
    /// called from both writes that fold events, so neither can grow without the count seeing it.
    private mutating func countFold(of events: [TranscriptEvent]) {
        #if DEBUG
            largestFold = max(largestFold, events.count)
        #endif
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
        let publishable = HubJoinPublishable(
            of: transcripts, owners: recordOwners, standing: standing,
        )
        standing = Set(publishable.transcripts.map(\.id))
        roster = HubSessionChain.roster(from: publishable.transcripts, owners: recordOwners)
        guard !publishable.isComplete else { return }
        roster.holdWrites()
    }
}

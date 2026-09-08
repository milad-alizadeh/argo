import Foundation

/// What the Hub is reading: the tails it has running, the join they feed, and what it can say about
/// its own connection. Every one of those is derived on READ, so no second copy can fall out of
/// step with the state it came from.
///
/// The sweep and the Subagent tails are HELD here and driven from `TranscriptWatch+Sweeping.swift`,
/// the way the reading extents are driven from `TranscriptWatch+Reading.swift`.
@MainActor
@Observable
final class TranscriptWatch {
    /// Internal rather than private, with `subagents`, `whole` and `reads` below it: the reading
    /// and sweeping halves of this watch are other files, and `private` in Swift is file-scoped.
    /// Every write to the join still goes through `mutate` alone.
    @ObservationIgnored let engine: Engine
    @ObservationIgnored private let sweep: WorkingSetSweep
    /// Where a Subagent's bytes go — beside the join rather than into it, so a child's batch
    /// invalidates the lane that draws it and not everything that draws a Session (#858).
    @ObservationIgnored private let readings: SubagentReadings
    /// Built lazily because the batches it reads land in the join below, and stored because a
    /// Subagent tail has to outlive the call that started it. Internal for `engine`'s reason: the
    /// sweeping half of this watch is another file, and `private` in Swift is file-scoped.
    @ObservationIgnored lazy var subagents = makeSubagentTails()

    /// What must run once a batch has landed in the join. Reconciliation is the Hub's answer and
    /// not this type's, but it may only happen after the join has been written.
    ///
    /// `async` because the Hub also spells the folders the batch has just named, which is a
    /// file-system read (ADR-0028 Rule 6). Awaited rather than started and forgotten, so a caller
    /// that has awaited a batch has awaited everything that follows from it.
    @ObservationIgnored var onApplied: @MainActor () async -> Void = {}

    /// What must run once a change has reached the roster — which is a PUBLISH and not a batch.
    ///
    /// Reconciliation reads the rows, and the join folds its roster on read (`HubJoin`), so a
    /// consequence hung off every batch would put that fold back under every write — which is the
    /// cost #1556 took off the opening fill. A publish is the moment the rows are worth reading,
    /// and it happens at a bounded rate (`+Publishing.swift`), so this costs one fold per window
    /// however many batches landed inside it.
    @ObservationIgnored var onPublished: @MainActor () -> Void = {}

    /// What must run once a sweep has moved the tails onto a new working set. A batch is not the
    /// only thing that changes
    /// which Session a row is: dropping the path a moved transcript left re-keys its row, and no
    /// batch need follow — the agent that moved the file may never write again (#1406).
    @ObservationIgnored var onWorkingSetMoved: @MainActor () -> Void = {}

    /// NOT observed, and `joinRevision` below is why: an `inout` access to an observed property
    /// publishes whether or not the body writes anything, so a join left observed would republish
    /// on every no-op write however carefully `mutate` guarded the stamp (#858). The two readers a
    /// view reaches — `sessions` here and `observations` in `+Reading` — register on the revision
    /// instead, which is the fact a write actually moves.
    @ObservationIgnored private(set) var join = HubJoin()
    /// Moved by `publish` and by nothing else — the roster's memo is keyed by it
    /// (`HubRosterMemo`), so a change that landed in the join without reaching that call would be
    /// a Session the cockpit never redraws. It is also the whole of what a reader of the join
    /// observes, per the note above.
    private(set) var joinRevision = 0
    /// When the revision above last moved, and the publish waiting on the window since — the rate
    /// limiter's whole state, driven from `+Publishing.swift`. Internal for the reason `join` is:
    /// a half of this type is another file.
    @ObservationIgnored var publishedAt: TimeInterval?
    @ObservationIgnored var waitingPublish: Task<Void, Never>?
    /// The rosters of the Projects this watch has been pointed at, kept across a switch. The sweep
    /// still re-runs and the tails still re-read on re-entry.
    @ObservationIgnored private var retained = HubJoinCache()
    /// The running tail per transcript id. A tail's presence in the table IS its liveness, so there
    /// is no second number to fall out of step.
    private(set) var tails: [String: Task<Void, Never>] = [:]
    /// Which admit each tail is running under — see `TranscriptAdmissions`. The table above cannot
    /// answer this on its own: a tail is registered AFTER a suspension, so two admits of one
    /// transcript can both reach it (#1237).
    @ObservationIgnored private var admissions = TranscriptAdmissions()
    /// The transcripts held on a WHOLE reading, and the ceiling on holding them — see
    /// `WholeReadings`. Written only by `TranscriptWatch+Reading.swift`.
    @ObservationIgnored var whole = WholeReadings()
    /// How many transcripts this watch has opened, at each extent — see
    /// `TranscriptWatch.observe(_:reading:)`.
    @ObservationIgnored var reads = TranscriptWatchReads()
    private var failureMessage: String?
    private var isConnecting = false

    init(engine: Engine, discovery: SessionDiscovery, readings: SubagentReadings) {
        self.engine = engine
        self.sweep = WorkingSetSweep(discovery: discovery)
        self.readings = readings
    }

    /// The Sessions the tails have read, in the order the join holds them.
    var sessions: [HubSession] {
        registerOnTheJoin()
        return join.sessions
    }

    /// "Connected" is a claim about a live source, and a Project with no tail running has none.
    ///
    /// A live tail is read BEFORE the connecting claim, because the gap that claim covers has no
    /// tail in it. The first sweep starts every tail and fills the join before `connect` returns,
    /// so the claim outlives the window it stands for (#1535).
    var connection: HubConnection {
        if let failureMessage {
            return .failed(message: failureMessage)
        }
        if !tails.isEmpty {
            return .connected
        }
        return isConnecting ? .connecting : .idle
    }

    func isObserving(transcriptID: String) -> Bool {
        tails[transcriptID] != nil
    }

    /// Hold the connecting claim open for the length of a re-point, so nothing reads the idle the
    /// watch passes through on the way.
    func whileConnecting(_ repoint: () async -> Void) async {
        isConnecting = true
        defer { isConnecting = false }
        await repoint()
    }

    /// Take back the reading retained for a Project, or start a fresh one. Keyed by the RESOLVED
    /// Project, which is the key it was retained under.
    ///
    /// The EXTENTS come back with the join, and that is not bookkeeping: the sweep that follows a
    /// repoint re-opens every transcript it finds, at the extent this table says it is held at, and
    /// a re-tail replaces the reading rather than adding to it (#1213). Restoring the join alone
    /// would re-read a Session the reader had open bounded, and take the middle of its file away.
    func restore(for key: String) {
        let reading = retained.take(for: key)
        whole = reading?.whole ?? WholeReadings()
        mutate { $0.replace(with: reading?.join ?? HubJoin()) }
    }

    /// Keep this Project's reading, before the tails are torn down — which is what empties it.
    func retain(for key: String) {
        retained.retain(HubJoinCache.Retained(join: join, whole: whole), for: key)
    }

    /// The whole named set is validated before any tail starts, and one unreadable name fails the
    /// connection rather than yielding a smaller roster. Discovery's own opens are skipped instead
    /// — see `move(onto:)`.
    func observeNamed(_ urls: [URL]) async {
        do {
            for observation in try engine.observeTranscripts(at: urls) {
                await startObserving(observation)
            }
        } catch {
            await stopAll()
            failureMessage = "Transcript unavailable"
        }
    }

    func beginSweeping(in projectURL: URL) async {
        await sweep.begin(in: projectURL, onSwept: { [weak self] wanted in
            await self?.move(onto: wanted)
        })
    }

    func stopSweeping() async {
        await sweep.stop()
    }

    /// Re-run the sweep now, rather than waiting for the record directory to change.
    func refreshWorkingSet() async {
        await sweep.refresh()
    }

    /// Start tailing one transcript, as a Session the roster has not seen before. It joins the
    /// working set immediately — the ROSTER once the file has been read.
    func startObserving(_ observation: TranscriptObservation) async {
        await stopObserving(transcriptID: observation.id)
        await startTailing(observation)
    }

    /// Stop one tail and drop its transcript from the join, leaving the rest tailing.
    func stopObserving(transcriptID: String) async {
        // Not an eviction: the transcript is going, so there is no bounded reading to fall back to.
        whole.drop(transcriptID)
        mutate { $0.remove(transcriptID: transcriptID) }
        // Surrendered before the tails go, and only here: a transcript DROPPED loses its Subagents'
        // readings the way it loses its row, where a paused one keeps both.
        readings.forget(claims: subagents.surrenderClaims(of: transcriptID))
        // The id is given up before the tail is stopped, so the drain that ends cannot settle a
        // transcript that is no longer in the join — or clear a key some later admit now holds.
        admissions.forget(transcriptID)
        await pauseObserving(transcriptID: transcriptID)
    }

    /// Stop one tail, keeping in the roster the Session it read. What discovery calls when a
    /// transcript ages out of the working set.
    ///
    /// Awaits the cancelled task, so a stopped tail is provably over before this returns — which
    /// keeps a straggling event from landing under an id re-registered in the meantime.
    func pauseObserving(transcriptID: String) async {
        await subagents.stop(of: transcriptID)
        guard let task = tails.removeValue(forKey: transcriptID) else { return }
        task.cancel()
        await task.value
    }

    /// The join is emptied before anything is cancelled, so a tail that gets one more turn while
    /// tearing down finds no transcript to apply against. Cancelling the whole set before awaiting
    /// any of it keeps a slow teardown from serialising behind the one in front of it.
    func stopAll() async {
        // Before the join is emptied: the change it is holding is one of the transcripts going.
        stopPublishing()
        await subagents.stopAll()
        readings.forgetAll()
        let stopped = Array(tails.values)
        tails = [:]
        admissions.forgetAll()
        whole = WholeReadings()
        mutate { $0.replace(with: HubJoin()) }
        // A failure is a claim about what could not be read, and nothing is being read now. The one
        // caller that wants it standing — `observeNamed` — sets it AFTER this returns.
        failureMessage = nil
        for task in stopped {
            task.cancel()
        }
        for task in stopped {
            await task.value
        }
    }

    /// Start a tail for one transcript, under the one join write that admits its reading —
    /// `HubJoin.add` for a transcript joining the set, `HubJoin.reread` for one being read again at
    /// a different extent (`TranscriptWatch+Reading.swift`).
    func tail(
        _ observation: TranscriptObservation,
        joining admit: (inout HubJoin) -> Bool,
    ) async {
        // Stamped BEFORE the wait below, which is what makes the guard after it mean anything:
        // the wait is where a second admit of this transcript overtakes this one (#1237).
        let admission = admissions.stamp(observation.id)
        await pauseObserving(transcriptID: observation.id)
        // Overtaken while waiting. Nothing is admitted and no tail is started: the admit that took
        // the id is reading this same file, and a second reader of it is the duplicate this guard
        // exists to prevent. The observation goes out of scope here, which is what releases the
        // descriptors it opened (`TranscriptTail`).
        guard admissions.owns(admission, observation.id) else { return }
        mutate(admit)
        // A connection reading `failed` over a live source is a stale claim.
        failureMessage = nil
        tails[observation.id] = Task { [weak self] in
            await self?.drain(observation, admitted: admission)
        }
        // Whatever the fan-out has written SO FAR. The rest arrives with the sweep, which is what
        // sees the file for a delegation handed over after this moment.
        await subagents.refresh(beside: [
            SubagentWalkRequest(transcriptID: observation.id, parentURL: observation.sourceURL),
        ])
    }

    /// The ONE write to the join. In place, so a batch costs no copy of the transcripts it lands
    /// in, and revision-stamped, so no write can reach the join without reaching the memo folded
    /// off it (ADR-0028 Rule 1).
    ///
    /// A change that MOVED nothing publishes nothing (#858). Whether it moved is the change's own
    /// answer, because only the write knows — every mutating method on `HubJoin` reports it.
    ///
    /// Here rather than in `+Publishing.swift` because `join`'s setter is file-scoped, which is
    /// what keeps this the only write there is. WHEN the change reaches a reader is that file's.
    func mutate(_ change: (inout HubJoin) -> Bool) {
        guard change(&join) else { return }
        publishTheChange()
    }

    /// Stamp the join, which is what a reader of it observes. Only `+Publishing.swift` calls it,
    /// so the rate a change reaches the cockpit at is settled in one place.
    func stampTheJoin() {
        joinRevision += 1
    }

    /// Register a read of the join on the one property a write to it publishes. Spelled once and
    /// called from both readers a view reaches, so neither can be written without it.
    func registerOnTheJoin() {
        _ = joinRevision
    }

    private func makeSubagentTails() -> SubagentTails {
        SubagentTails(engine: engine, readings: readings)
    }

    private func drain(
        _ observation: TranscriptObservation,
        admitted admission: TranscriptAdmissions.Admission,
    ) async {
        for await events in observation.events {
            await land(events, of: observation.id)
            // After the join, never before: reconciliation retires a spawned Session's own row, and
            // it may only do that once the observed row it is standing in for is published.
            await onApplied()
        }
        // A tail whose id has since moved on settles nothing and clears nothing: the transcript
        // was dropped, or a later admit owns it and is reading it now. Either way this reading is
        // not the one the roster is standing on, and `abandonReread` here would take away the
        // reread that admit is holding (#1237).
        guard admissions.owns(admission, observation.id) else { return }
        // A tail that ended without delivering a backfill — an unopenable file, or one stopped
        // mid-read — still has to settle, or the roster waits on a transcript that never speaks.
        mutate { $0.settle(transcriptID: observation.id) }
        tails.removeValue(forKey: observation.id)
    }
}

extension TranscriptWatch {
    /// Transfer a tail between the two paths of one transcript without publishing the gap between
    /// them. Its stale reading stands until the replacement path's backfill lands.
    func relocate(_ transcript: HubTranscript, to observation: TranscriptObservation) async {
        whole.relocate(from: transcript.id, to: observation.id)
        readings.forget(claims: subagents.surrenderClaims(of: transcript.id))
        admissions.forget(transcript.id)
        await pauseObserving(transcriptID: transcript.id)
        await tail(observation) { $0.relocate(observation, from: transcript.id) }
    }
}

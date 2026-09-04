import Foundation

/// What the Hub is reading: the tails it has running, the join they feed, and what it can say about
/// its own connection. Every one of those is derived on READ, so no second copy can fall out of
/// step with the state it came from.
///
/// The sweep that moves the working set and the Subagent files tailed beside it are held here.
@MainActor
@Observable
final class TranscriptWatch {
    /// Internal rather than private, with the two below it: the reading half of this watch — what
    /// it is reading and at what extent — is `TranscriptWatch+Reading.swift`, and `private` in
    /// Swift is file-scoped. Every write to the join still goes through `mutate` alone.
    @ObservationIgnored let engine: Engine
    @ObservationIgnored private let sweep: WorkingSetSweep
    /// Where a Subagent's bytes go — beside the join rather than into it, so a child's batch
    /// invalidates the lane that draws it and not everything that draws a Session (#858).
    @ObservationIgnored private let readings: SubagentReadings
    /// Built lazily because the batches it reads land in the join below, and stored because a
    /// Subagent tail has to outlive the call that started it.
    @ObservationIgnored private lazy var subagents = makeSubagentTails()

    /// What must run once a batch has landed in the join. Reconciliation is the Hub's answer and
    /// not this type's, but it may only happen after the join has been written.
    ///
    /// `async` because the Hub also spells the folders the batch has just named, which is a
    /// file-system read (ADR-0028 Rule 6). Awaited rather than started and forgotten, so a caller
    /// that has awaited a batch has awaited everything that follows from it.
    @ObservationIgnored var onApplied: @MainActor () async -> Void = {}

    /// NOT observed, and `joinRevision` below is why: an `inout` access to an observed property
    /// publishes whether or not the body writes anything, so a join left observed would republish
    /// on every no-op write however carefully `mutate` guarded the stamp (#858). The two readers a
    /// view reaches — `sessions` here and `observations` in `+Reading` — register on the revision
    /// instead, which is the fact a write actually moves.
    @ObservationIgnored private(set) var join = HubJoin()
    /// Bumped by `mutate` and by nothing else — the roster's memo is keyed by it
    /// (`HubRosterMemo`), so a batch that landed in the join without going through the one write
    /// below would be a Session the cockpit never redraws. It is also the whole of what a reader
    /// of the join observes, per the note above.
    private(set) var joinRevision = 0
    /// The rosters of the Projects this watch has been pointed at, kept across a switch. The sweep
    /// still re-runs and the tails still re-read on re-entry.
    @ObservationIgnored private var retained = HubJoinCache()
    /// The running tail per transcript id. A tail's presence in the table IS its liveness, so there
    /// is no second number to fall out of step.
    private(set) var tails: [String: Task<Void, Never>] = [:]
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
    var connection: HubConnection {
        if let failureMessage {
            return .failed(message: failureMessage)
        }
        if isConnecting {
            return .connecting
        }
        return tails.isEmpty ? .idle : .connected
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

    /// Take back the join retained for a Project, or start a fresh one. Keyed by the RESOLVED
    /// Project, which is the key it was retained under.
    func restore(for key: String) {
        mutate { $0.replace(with: retained.take(for: key) ?? HubJoin()) }
    }

    /// Keep this Project's join, before the tails are torn down — which is what empties it.
    func retain(for key: String) {
        retained.retain(join, for: key)
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
        await subagents.stopAll()
        readings.forgetAll()
        let stopped = Array(tails.values)
        tails = [:]
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

    /// Start tailing one transcript, keeping whatever row the roster already holds for it.
    ///
    /// The join resolves a record's owner by which transcript claimed it FIRST, so re-adding a
    /// paused resume-chain root would put it behind its own continuation and re-attribute the
    /// records it authored. A tail re-reads from the start of the file.
    private func startTailing(_ observation: TranscriptObservation) async {
        await tail(observation) { $0.add(observation) }
    }

    /// Start a tail for one transcript, under the one join write that admits its reading —
    /// `HubJoin.add` for a transcript joining the set, `HubJoin.reread` for one being read again at
    /// a different extent (`TranscriptWatch+Reading.swift`).
    func tail(
        _ observation: TranscriptObservation,
        joining admit: (inout HubJoin) -> Bool,
    ) async {
        await pauseObserving(transcriptID: observation.id)
        mutate(admit)
        // A connection reading `failed` over a live source is a stale claim.
        failureMessage = nil
        tails[observation.id] = Task { [weak self] in await self?.drain(observation) }
        // Whatever the fan-out has written SO FAR. The rest arrives with the sweep, which is what
        // sees the file for a delegation handed over after this moment.
        subagents.refresh(of: observation.id, beside: observation.sourceURL)
    }

    /// Move the tails onto the sweep's answer: a transcript recorded since the last one starts
    /// being tailed, and one that has aged out of the window stops — keeping its row, because it is
    /// the descriptors that are bounded and not the roster.
    private func move(onto wanted: [URL]) async {
        let wantedIDs = Set(wanted.map(\.path))
        for transcript in join.transcripts where !wantedIDs.contains(transcript.id) {
            await stopReading(transcript)
        }
        for url in wanted where !isObserving(transcriptID: url.path) {
            // A file the sweep saw a moment ago can be gone by the time it is opened. Skipping it
            // is the honest answer: nobody named this file, and the next sweep sees it again if it
            // comes back — where a named transcript that cannot be read is a failed connection.
            // BOUNDED: a sweep reads the two ends of every transcript it admits and nothing
            // between them, which is what makes a week-wide working set affordable
            // (`TranscriptExcerpt`). The whole file is read on the click that selects it.
            guard let observation = try? observe(url, reading: .excerpt) else { continue }
            await startTailing(observation)
        }
        // Every sweep, not only the ones that moved a tail: a fan-out's files appear beside a
        // transcript that is already in the working set, so nothing above would notice them.
        for transcript in join.transcripts where isObserving(transcriptID: transcript.id) {
            subagents.refresh(of: transcript.id, beside: transcript.sourceURL)
        }
    }

    /// Stop reading a transcript the sweep no longer names. Aged out of the window it keeps its
    /// row; GONE FROM DISK it loses it, because a vanished path can never say anything again — and
    /// Claude Code MOVES a transcript into the worktree's own record directory (#770).
    private func stopReading(_ transcript: HubTranscript) async {
        guard FileManager.default.fileExists(atPath: transcript.sourceURL.path) else {
            await stopObserving(transcriptID: transcript.id)
            return
        }
        await pauseObserving(transcriptID: transcript.id)
    }

    /// The ONE write to the join. In place, so a batch costs no copy of the transcripts it lands
    /// in, and revision-stamped, so no write can reach the join without reaching the memo folded
    /// off it (ADR-0028 Rule 1).
    ///
    /// A change that MOVED nothing publishes nothing (#858). Whether it moved is the change's own
    /// answer, because only the write knows — every mutating method on `HubJoin` reports it.
    ///
    /// Internal rather than private for the reason the three stored properties above are: the
    /// reading half of this watch is another file, and `private` in Swift is file-scoped. It is
    /// still the only write there is.
    func mutate(_ change: (inout HubJoin) -> Bool) {
        guard change(&join) else { return }
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

    private func drain(_ observation: TranscriptObservation) async {
        for await events in observation.events {
            await land(events, of: observation.id)
            // After the join, never before: reconciliation retires a spawned Session's own row, and
            // it may only do that once the observed row it is standing in for is published.
            await onApplied()
        }
        // A tail that ended without delivering a backfill — an unopenable file, or one stopped
        // mid-read — still has to settle, or the roster waits on a transcript that never speaks.
        mutate { $0.settle(transcriptID: observation.id) }
        // Clearing by id is safe: every path that re-registers an id awaits the previous tail to
        // completion first, so no later tail can be holding the key by the time this runs.
        tails.removeValue(forKey: observation.id)
    }
}

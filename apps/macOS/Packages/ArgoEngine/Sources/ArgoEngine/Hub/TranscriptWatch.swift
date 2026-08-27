import Foundation

/// What the Hub is reading: the tails it has running, the join they feed, and what it can say about
/// its own connection. Every one of those is derived on READ, so no second copy can fall out of
/// step with the state it came from.
///
/// The sweep that moves the working set and the Subagent files tailed beside it are held HERE
/// rather than beside it. Neither exists except to serve these tails, and a caller able to start
/// one without the other could leave a sweep re-registering transcripts of a Project nobody is on.
@MainActor
@Observable
final class TranscriptWatch {
    @ObservationIgnored private let engine: Engine
    @ObservationIgnored private let sweep: WorkingSetSweep
    /// Built lazily because the batches it reads land in the join below, and stored because a
    /// Subagent tail has to outlive the call that started it.
    @ObservationIgnored private lazy var subagents = makeSubagentTails()

    /// What must run once a batch has landed in the join. Reconciliation is the Hub's answer and
    /// not this type's, but it may only happen after the join has been written.
    @ObservationIgnored var onApplied: @MainActor () -> Void = {}

    private var join = HubJoin()
    /// The rosters of the Projects this watch has been pointed at, kept across a switch. The sweep
    /// still re-runs and the tails still re-read on re-entry.
    @ObservationIgnored private var retained = HubJoinCache()
    /// The running tail per transcript id. A tail's presence in the table IS its liveness, so there
    /// is no second number to fall out of step.
    private var tails: [String: Task<Void, Never>] = [:]
    private var failureMessage: String?
    private var isConnecting = false

    init(engine: Engine, discovery: SessionDiscovery) {
        self.engine = engine
        self.sweep = WorkingSetSweep(discovery: discovery)
    }

    /// The Sessions the tails have read, in the order the join holds them.
    var sessions: [HubSession] {
        join.sessions
    }

    /// What is being read, per transcript, in the order the transcripts joined the set.
    var observations: [HubObservation] {
        join.transcripts.map { transcript in
            HubObservation(
                id: transcript.id,
                sourceURL: transcript.sourceURL,
                state: tails[transcript.id] == nil ? .stopped : .live,
            )
        }
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
        join = retained.take(for: key) ?? HubJoin()
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
        await sweep.begin(in: projectURL) { [weak self] wanted in
            await self?.move(onto: wanted)
        }
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
        join.remove(transcriptID: transcriptID)
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
        let stopped = Array(tails.values)
        tails = [:]
        join = HubJoin()
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
        await pauseObserving(transcriptID: observation.id)
        join.add(observation)
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
            guard let observation = try? engine.observeTranscript(at: url) else { continue }
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

    private func makeSubagentTails() -> SubagentTails {
        SubagentTails(engine: engine) { [weak self] read, agentID, transcriptID in
            self?.join.apply(read, ofSubagent: agentID, to: transcriptID)
        }
    }

    private func drain(_ observation: TranscriptObservation) async {
        for await events in observation.events {
            join.apply(events, to: observation.id)
            // After the join, never before: reconciliation retires a spawned Session's own row, and
            // it may only do that once the observed row it is standing in for is published.
            onApplied()
        }
        // A tail that ended without delivering a backfill — an unopenable file, or one stopped
        // mid-read — still has to settle, or the roster waits on a transcript that never speaks.
        join.settle(transcriptID: observation.id)
        // Clearing by id is safe: every path that re-registers an id awaits the previous tail to
        // completion first, so no later tail can be holding the key by the time this runs.
        tails.removeValue(forKey: observation.id)
    }
}

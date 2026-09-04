import Foundation

/// Argo starting a Session of its own — the one case where it is not observing. DIRECT: Argo holds
/// the claim and the process, which is why the row is published here rather than waited for —
/// `claude` writes no record until its first prompt (#361).
@MainActor
public extension Hub {
    /// Launch the Project's agent, own its process, and put it in the roster. Returns the claim,
    /// which is also the id of the row it just published. The seed is what a handoff adds and a New
    /// Session leaves empty (#513): a folder other than the Project's, and a prompt to open on.
    ///
    /// A seed naming a chain to resume takes the same path (#10). Two things differ, and both
    /// follow from the Session already existing: the claim carries its roster id rather than a
    /// transcript to expect, and no provisional row is published because there is one already.
    @discardableResult
    func spawnSession(
        cli: AgentCLI = .claude,
        seed: SessionSeed = .unseeded,
    ) async throws
        -> SessionOwnership.ClaimID {
        guard spawnServices.hosts.pty != nil else {
            throw AgentSpawnError.hostRefused(detail: "This window cannot start agents")
        }
        let cwd = seed.cwd ?? project.url.path
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: cwd, isDirectory: &isDirectory),
              isDirectory.boolValue
        else { throw AgentSpawnError.unreachableWorkingDirectory(path: cwd) }

        // The transcript a fresh spawn will write, minted here so the claim and the argv name one
        // file (#742). A resume needs none: it knows its Session already.
        let namedUUID = seed.resuming == nil && cli.namesFreshSession
            ? spawnServices.mintTranscriptID()
            : nil
        // The seed's rung, or the one the user last picked (#629) — resolved once, so what the CLI
        // is started with and the rung the row publishes cannot be two different answers.
        let plan = AgentSpawnPlan(
            cli: cli,
            cwd: cwd,
            mode: seed.mode ?? modeStore.lastPicked(),
            // The pair the user last picked, resolved here for the reason the rung is: the argv
            // and the row this spawn publishes must state one answer (#1175). A resume answers off
            // the Session it continues instead — see `run(resuming:)`.
            run: seed.resuming.map { run(resuming: $0.sessionID) } ?? runStore.lastPicked(),
            seed: seed,
            claim: claim(for: seed, naming: namedUUID),
            namedUUID: namedUUID,
        )
        do {
            try await start(plan)
            publish(plan)
            // The provisional row's folder, spelled at the one moment it is known. A spawn is in no
            // transcript and in no sweep yet, so without this its row would match no process and no
            // worktree until the next sweep (#959) — see `Hub.didApply()`.
            await readings.spell(theProjectRootAnd: [cwd], settling: .foldersNotYetSpelled)
            return plan.claim
        } catch {
            // Nothing started, so nothing is owned. Relinquishing keeps the window from covering an
            // agent somebody else starts in this folder a moment later.
            relinquish(plan.claim)
            throw error
        }
    }

    /// Every process this Hub owns, ended, and every channel with them. What window close and app
    /// quit call: an agent Argo started must not outlive the Argo that started it.
    ///
    /// The live claims are the whole set to walk: a socket is opened at spawn and closed by
    /// `relinquish`, which is also the only thing that releases a claim, so no gate can be open
    /// behind a claim this loop does not reach.
    func endOwnedSessions() {
        terminals.terminateAll()
        delivery.forgetAll()
        for claim in ownership.liveClaims {
            relinquish(claim)
        }
    }

    /// The act of ownership this spawn opens, and the three things a claim can know about its
    /// Session: its roster id (a resume), the transcript it was told to write (a fresh `claude`),
    /// or nothing — a CLI that picks its own id, which Argo will never match back to this claim.
    private func claim(
        for seed: SessionSeed,
        naming uuid: String?,
    )
        -> SessionOwnership.ClaimID {
        if let resuming = seed.resuming {
            return ownership.claim(resuming: resuming.sessionID)
        }
        guard let uuid else { return ownership.claim() }
        return ownership.claim(naming: uuid)
    }

    /// The process, then whatever its CLI needs beyond one — both asked of the port, so nothing
    /// switches on which CLI it is starting (#749). Adopted between the two: a channel that writes
    /// to the process has nothing to write to before then.
    private func start(_ plan: AgentSpawnPlan) async throws {
        let process = try await adapters.host(for: plan, besides: ptyHost()).start(
            plan.launch(from: spawnServices.launcher, inviting: invite),
            events: events(for: plan.claim),
        )
        terminals.adopt(plan.claim, process: process)
        adapters.open(plan)
    }

    /// The grant is minted with the invitation: the hook is what carries it, so a plugin nobody was
    /// invited to leaves nothing to gate.
    private func invite(_ claim: SessionOwnership.ClaimID) throws -> CompanionInvitation? {
        try companion?.invite(claim, gatedBy: permissions?.grant(claim))
    }

    /// Filed under the CLAIM, which is the only key that survives the re-key to the id the CLI
    /// picks — a rung on the row below would be lost with it, and the gate reads this to decide
    /// whether the Session asks at all (#663).
    ///
    /// A resume continues a Session that has already written stance records, so the set is counted
    /// from THAT: from zero, its very next record would read as the CLI overruling a flag it had in
    /// fact honoured. It already has its row, too, so publishing a second one would draw that
    /// Session twice until the CLI wrote a record.
    private func publish(_ plan: AgentSpawnPlan) {
        claims.setMode(
            SessionModeSet(
                mode: plan.mode,
                recordsWhenSet: plan.seed.resuming.map { observedModeCount(of: $0.sessionID) } ?? 0,
            ),
            for: plan.claim,
        )
        // What Argo put on this Session's argv (#1175). DIRECT for as long as it is the only thing
        // that has spoken: the first record's own reading supersedes it, and the composer states
        // this in the meantime rather than `unknown`. Filed under the claim like the rung above.
        if plan.cli.takesRunFlags {
            claims.setRun(plan.run, for: plan.claim)
        }
        // Filed under the claim for the reason the rung is: it must survive the re-key to the id
        // the CLI picks, or the Tickets room would show the ticket claimed only until the
        // transcript appeared (#872). A resume names one too — it is the same work, continued.
        if let ticket = plan.seed.ticket {
            claims.setTicket(ticket, for: plan.claim)
            // And into the durable ledger, which is the only one of the two a relaunch reads
            // (#894).
            ownership.record(ticket: ticket, ofClaim: plan.claim)
        }
        guard plan.seed.resuming == nil else { return }
        // The rung this Session was STARTED on, into the ledger for the reason the ticket goes
        // there: a resume runs in a later process, and only the file crosses that gap (#966).
        // Only a rung the SEED named — a spawn that took the rung last picked started on nobody's
        // choice for this Session, and a resume must not read an old pick as one.
        if let rung = plan.seed.mode {
            ownership.record(startingRung: rung, ofClaim: plan.claim)
        }
        spawns[plan.claim] = AgentSpawn(spawning: plan, atMs: Date().epochMs)
        armStartupWait(plan.claim)
    }

    /// Put a limit on the `starting` wait (#1245). Argo started this process and has heard nothing
    /// from it, and before this the only two ways out were bytes and an exit — so a child that came
    /// up and printed nothing held the row until the window closed.
    ///
    /// Weak, and guarded again at the far end: the whole point of the wait is that it may be
    /// answered while it runs, and the answer is read at the moment it fires rather than captured
    /// when it is armed.
    private func armStartupWait(_ claim: SessionOwnership.ClaimID) {
        startupClocks[claim] = Task { [weak self, patience = spawnServices.patience.startup] in
            await patience.elapse()
            guard !Task.isCancelled else { return }
            self?.startupWaitRanOut(claim)
        }
    }

    /// The wait ran out. Two answers, and Argo can tell them apart because it owns the process:
    /// the child is up and has printed nothing, or it is gone and its exit was never reported.
    ///
    /// A gone child is written as the exit it is, through the one path every process that ended
    /// already takes — the row it publishes says `claude exited` and reads `ended`, which is what
    /// "it is gone" looks like on screen. A live one leaves the row to fall through to the DERIVED
    /// reading it would have taken had the CLI printed a prompt, with the quiet recorded beside it.
    private func startupWaitRanOut(_ claim: SessionOwnership.ClaimID) {
        guard let spawn = spawns[claim], spawn.startup == AgentSpawn.Startup() else { return }
        guard terminals.isRunning(claim) else {
            // Signalled before the row is retired, because this death is INFERRED rather than
            // watched: `isRunning` reads the child's own descriptor, which can go quiet under a
            // process that is still alive, and one dropped from the table unasked would outlive
            // the window that started it.
            terminals.terminate(claim)
            // No code: nothing reported one, and absent is not zero.
            processEnded(claim, exitCode: nil)
            return
        }
        var quiet = spawn
        quiet.startup.quietAtMs = Date().epochMs
        spawns[claim] = quiet
    }

    /// One claim, given up: Argo's hold on it, the process behind it, and every channel it spoke
    /// over. The three sites that give a claim up are a launch that failed, a process that exited,
    /// and the app quitting.
    private func relinquish(_ claim: SessionOwnership.ClaimID) {
        // Before the claim is released, because the watch is keyed by Session and the id is read
        // back through the claim that is about to stop answering.
        //
        // BOTH ids, because a watch is keyed by the id the Turn was typed at and a fresh Session
        // answers to two of them: its claim's until the CLI's first record re-keys the row, and
        // the transcript's after (#1176). Dropping only the resolved one leaves a first Turn still
        // watched at a PTY that has just gone, and the watch would report lost the one thing
        // `forget` exists to keep quiet.
        // The startup wait has its answer — the claim is being given up — and a clock left armed
        // would ask a retired spawn whether its process is up (#1245).
        startupClocks.removeValue(forKey: claim)?.cancel()
        delivery.forget(claim.value)
        delivery.forget(ownership.rowID(ofClaim: claim.value))
        ownership.release(claim)
        adapters.close(claim)
        companion?.withdraw(claim)
        permissions?.withdraw(claim)
    }

    /// A chunk goes to ONE channel, and which one is the port's to answer: a Codex claim's bytes
    /// are JSON-RPC and belong to its thread, and the Hub answering that itself was the third place
    /// per-CLI knowledge had accreted (#749).
    private func events(for claim: SessionOwnership.ClaimID) -> AgentProcessEvents {
        AgentProcessEvents(
            onData: { [weak self] chunk in
                self?.noteFirstOutput(of: claim)
                self?.adapters.received(chunk, from: claim)
            },
            onExit: { [weak self] code in self?.processEnded(claim, exitCode: code) },
        )
    }

    /// The agent has spoken, so the row stops reading `starting` (#587). Written ONCE: the moment
    /// sits on a row `rosterStamp` reads, so restamping it per chunk would rebuild the whole roster
    /// for every byte the agent prints.
    private func noteFirstOutput(of claim: SessionOwnership.ClaimID) {
        guard var spawn = spawns[claim], spawn.startup.firstOutputAtMs == nil else { return }
        spawn.startup.firstOutputAtMs = Date().epochMs
        // A child that speaks LATE is starting late rather than quiet, so the bytes take back the
        // word the limit wrote (#1245). Cancelled here as well: the wait has its answer.
        spawn.startup.quietAtMs = nil
        spawns[claim] = spawn
        startupClocks[claim]?.cancel()
    }

    /// The process is gone. Ownership cannot be re-adopted, so the claim closes and the Session
    /// demotes to `orphaned` — a row still under the claim's own id is one no sweep will ever
    /// correct, because the CLI never wrote a record.
    private func processEnded(_ claim: SessionOwnership.ClaimID, exitCode: Int32?) {
        relinquish(claim)
        // The spawn itself stays: it is a ROW rather than a fact about one, and the exit code is
        // what this writes into it.
        guard var spawn = spawns[claim] else { return }
        spawn.startup.exit = AgentSpawn.Exit(code: exitCode, atMs: Date().epochMs)
        spawns[claim] = spawn
    }
}

@MainActor
extension Hub {
    /// The startup wait for one claim, awaited to its end (#1245). The seam a suite drives
    /// `StartupPatience.immediate` through: the clock is the real one, and this is only the moment
    /// it finishes. Returns at once where no clock is armed, which is every claim whose wait has
    /// already been answered.
    func awaitStartupWait(_ claim: SessionOwnership.ClaimID) async {
        await startupClocks[claim]?.value
    }

    /// Retire the row a spawn published, now that the record it turned out to be has appeared.
    /// Safe on every batch: a Session binds to at most one claim, so a re-observation of a bound
    /// one reports nothing and the row cannot be retired twice. The observed Session is never
    /// re-keyed to the claim's id — that would break every link made against the id the CLI chose.
    ///
    /// A claim reports a SECOND time where the CLI moved its transcript (#942). Retiring is
    /// idempotent, so this loop takes that answer as it takes the first; the written handoff link
    /// below keeps naming the path it was made against, which is the id that Session was known by
    /// when the handoff happened.
    func reconcileSpawns() {
        for session in watch.sessions {
            guard let claim = ownership.bind(
                sessionID: session.id,
                uuid: session.transcriptUUID,
            ) else { continue }
            spawns.removeValue(forKey: claim)
            // The one moment a written handoff link can stop naming a claim and name a Session
            // instead — binding happens once per claim and this is the call that knows it did
            // (#513).
            handoff.name(claim: claim, as: session.id)
        }
    }
}

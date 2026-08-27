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
        guard spawnServices.host != nil else {
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
            seed: seed,
            claim: claim(for: seed, naming: namedUUID),
            namedUUID: namedUUID,
        )
        do {
            try await start(plan)
            publish(plan)
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
        guard plan.seed.resuming == nil else { return }
        spawns[plan.claim] = AgentSpawn(spawning: plan, atMs: Date().epochMs)
    }

    /// One claim, given up: Argo's hold on it, the process behind it, and every channel it spoke
    /// over. The three sites that give a claim up are a launch that failed, a process that exited,
    /// and the app quitting.
    private func relinquish(_ claim: SessionOwnership.ClaimID) {
        // Before the claim is released, because the watch is keyed by Session and the id is read
        // back through the claim that is about to stop answering.
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
            onData: { [weak self] chunk in self?.adapters.received(chunk, from: claim) },
            onExit: { [weak self] code in self?.processEnded(claim, exitCode: code) },
        )
    }

    /// The process is gone. Ownership cannot be re-adopted, so the claim closes and the Session
    /// demotes to `orphaned` — a row still under the claim's own id is one no sweep will ever
    /// correct, because the CLI never wrote a record.
    private func processEnded(_ claim: SessionOwnership.ClaimID, exitCode: Int32?) {
        relinquish(claim)
        // The spawn itself stays: it is a ROW rather than a fact about one, and the exit code is
        // what this writes into it.
        guard var spawn = spawns[claim] else { return }
        spawn.exit = AgentSpawn.Exit(code: exitCode, atMs: Date().epochMs)
        spawns[claim] = spawn
    }
}

@MainActor
extension Hub {
    /// Retire the row a spawn published, now that the record it turned out to be has appeared.
    /// Safe on every batch: a Session binds to at most one claim, once, so a re-observation reports
    /// nothing and the row cannot be retired twice. The observed Session is never re-keyed to the
    /// claim's id — that would break every link made against the id the CLI chose.
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

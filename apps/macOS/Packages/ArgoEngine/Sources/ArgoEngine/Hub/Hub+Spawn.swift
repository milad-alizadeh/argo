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
    /// follow from the Session already existing: the claim is bound to its id rather than matched
    /// back by folder and time, and no provisional row is published because there is one already.
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

        // The seed's rung, or the one the user last picked (#629) — resolved once, so what the CLI
        // is started with and the rung the row publishes cannot be two different answers.
        let plan = AgentSpawnPlan(
            cli: cli,
            cwd: cwd,
            mode: seed.mode ?? modeStore.lastPicked(),
            seed: seed,
            claim: seed.resuming.map { ownership.claim(cwd: cwd, resuming: $0) }
                ?? ownership.claim(cwd: cwd),
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
        for claim in ownership.liveClaims {
            relinquish(claim)
        }
    }

    private func start(_ plan: AgentSpawnPlan) async throws {
        let process = try await host(for: plan.cli).start(
            launch(for: plan),
            events: events(for: plan.claim),
        )
        terminals.adopt(plan.claim, process: process)
        openThread(for: plan)
    }

    /// What the CLI is started with. The companion plugin and the permission gate are `claude`'s
    /// alone: the bundle speaks Claude Code's plugin format, and Codex raises its approvals over
    /// the protocol rather than through a hook (ADR-0024).
    private func launch(for plan: AgentSpawnPlan) async throws -> AgentLaunch {
        let invitation = plan.cli == .claude
            ? try companion?.invite(plan.claim, gatedBy: permissions?.grant(plan.claim))
            : nil
        let launch = try await spawnServices.launcher.launch(
            cli: plan.cli,
            cwd: plan.cwd,
            companion: invitation,
        )
        .adding(plan.cli.surfaceArguments)
        .adding(plan.cli.arguments(standingOn: plan.mode))
        .adding(plan.seed.resuming.map(plan.cli.arguments(resuming:)) ?? [])
        // Codex opens on a Turn rather than on argv — see `openThread`.
        guard plan.cli == .claude, let opening = plan.seed.opening else { return launch }
        return launch.opening(opening)
    }

    /// A Codex spawn is a JSON-RPC client as well as a process: the thread is asked for the moment
    /// the server is up, and the seed's prompt is its first Turn. Queued rather than sent, because
    /// the thread does not exist until the server says it does.
    private func openThread(for plan: AgentSpawnPlan) {
        guard plan.cli == .codex else { return }
        let claim = plan.claim
        let thread = CodexThread(cwd: plan.cwd, mode: plan.mode) { [weak self] line in
            self?.terminals.write(line, to: claim) ?? false
        }
        codex.open(claim, thread: thread)
        guard let opening = plan.seed.opening else { return }
        _ = thread.send(opening)
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
                recordsWhenSet: plan.seed.resuming.map(observedModeCount(of:)) ?? 0,
            ),
            for: plan.claim,
        )
        guard plan.seed.resuming == nil else { return }
        spawns[plan.claim] = AgentSpawn(
            claim: plan.claim,
            cli: plan.cli,
            cwd: plan.cwd,
            spawnedAtMs: Date().epochMs,
        )
    }

    /// One claim, given up: Argo's hold on it, the process behind it, and every channel it spoke
    /// over. The three sites that give a claim up are a launch that failed, a process that exited,
    /// and the app quitting.
    private func relinquish(_ claim: SessionOwnership.ClaimID) {
        ownership.release(claim)
        terminals.drop(claim)
        codex.close(claim)
        companion?.withdraw(claim)
        permissions?.withdraw(claim)
    }

    /// Every chunk goes to both tables. The codex one answers only for a claim it holds a thread
    /// for, so a `claude` PTY's bytes reach it and stop there.
    private func events(for claim: SessionOwnership.ClaimID) -> AgentProcessEvents {
        AgentProcessEvents(
            onData: { [weak self] chunk in
                self?.terminals.received(chunk, from: claim)
                self?.codex.received(chunk, from: claim)
            },
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
        for session in join.sessions {
            guard let claim = ownership.bind(
                sessionID: session.id,
                cwd: session.cwd,
                startedAtMs: session.startedAtMs,
            ) else { continue }
            spawns.removeValue(forKey: claim)
            // The one moment a written handoff link can stop naming a claim and name a Session
            // instead — binding happens once per claim and this is the call that knows it did
            // (#513).
            handoff.name(claim: claim, as: session.id)
        }
    }
}

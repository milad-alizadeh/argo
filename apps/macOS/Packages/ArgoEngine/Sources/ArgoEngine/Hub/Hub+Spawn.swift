import Foundation

/// Argo starting a Session of its own — the one case where it is not observing. DIRECT: Argo holds
/// the claim and the PTY, which is why the row is published here rather than waited for — `claude`
/// writes no record until its first prompt (#361).
@MainActor
public extension Hub {
    /// Launch the Project's agent, own its PTY, and put it in the roster. Returns the claim, which
    /// is also the id of the row it just published. The seed is what a handoff adds and a New
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
        guard let host = spawnServices.host else {
            throw AgentSpawnError.hostRefused(detail: "This window cannot start agents")
        }
        let cwd = seed.cwd ?? project.url.path
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: cwd, isDirectory: &isDirectory),
              isDirectory.boolValue
        else { throw AgentSpawnError.unreachableWorkingDirectory(path: cwd) }

        // The seed's rung, or the one the user last picked (#629) — resolved once, so the argv the
        // CLI is launched with and the rung the row publishes cannot be two different answers.
        let mode = seed.mode ?? modeStore.lastPicked()
        let claim = seed.resuming.map { ownership.claim(cwd: cwd, resuming: $0) }
            ?? ownership.claim(cwd: cwd)
        do {
            let invitation = try companion?.invite(claim, gatedBy: permissions?.grant(claim))
            let launch = try await spawnServices.launcher.launch(
                cli: cli,
                cwd: cwd,
                companion: invitation,
            )
            .adding(cli.arguments(standingOn: mode))
            .adding(seed.resuming.map(cli.arguments(resuming:)) ?? [])
            let process = try host.start(
                seed.opening.map(launch.opening) ?? launch,
                events: events(for: claim),
            )
            terminals.adopt(claim, process: process)
            // Filed under the CLAIM as well as on the row, so the rung outlives the re-key to the
            // id the CLI picks (#663). The row published below stands down at that moment, and
            // until the first stance record lands it is the only thing that knows the rung — which
            // the gate reads to decide whether this Session asks at all. A resume publishes no row
            // at all, so there it is the only place the rung ever lives.
            claims.setMode(SessionModeSet(mode: mode), for: claim)
            // A resume already has its row — the Session it continues — so publishing a second one
            // would draw that Session twice until the CLI wrote a record.
            if seed.resuming == nil {
                spawns[claim] = AgentSpawn(
                    claim: claim,
                    cli: cli,
                    cwd: cwd,
                    spawnedAtMs: Date().epochMs,
                    mode: mode,
                )
            }
            return claim
        } catch {
            // Nothing started, so nothing is owned. Relinquishing keeps the window from covering an
            // agent somebody else starts in this folder a moment later.
            relinquish(claim)
            throw error
        }
    }

    /// Every PTY this Hub owns, ended, and every channel with them. What window close and app quit
    /// call: an agent Argo started must not outlive the Argo that started it.
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

    /// One claim, given up: Argo's hold on it, the PTY behind it, and both channels it spoke over.
    /// The three sites that give a claim up are a launch that failed, a PTY that exited, and the
    /// app quitting.
    private func relinquish(_ claim: SessionOwnership.ClaimID) {
        ownership.release(claim)
        terminals.drop(claim)
        companion?.withdraw(claim)
        permissions?.withdraw(claim)
    }

    private func events(for claim: SessionOwnership.ClaimID) -> AgentProcessEvents {
        AgentProcessEvents(
            onData: { [weak self] chunk in self?.terminals.received(chunk, from: claim) },
            onExit: { [weak self] code in self?.ptyEnded(claim, exitCode: code) },
        )
    }

    /// The PTY is gone. Ownership cannot be re-adopted, so the claim closes and the Session demotes
    /// to `orphaned` — a row still under the claim's own id is one no sweep will ever correct,
    /// because the CLI never wrote a record.
    private func ptyEnded(_ claim: SessionOwnership.ClaimID, exitCode: Int32?) {
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

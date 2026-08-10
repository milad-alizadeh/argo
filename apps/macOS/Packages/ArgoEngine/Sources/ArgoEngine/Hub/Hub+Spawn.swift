import Foundation

/// Argo starting a Session of its own — the one case where it is not observing.
///
/// Everything else in the Hub reads the world; this acts on it. What comes back is DIRECT: Argo
/// holds the claim and the PTY, and that is exactly why the row is published here rather than
/// waited for. `claude` writes no record until its first prompt, so waiting would leave the roster
/// silent about the one Session Argo knows for certain (#361).
@MainActor
public extension Hub {
    /// Launch the Project's agent, own its PTY, and put it in the roster. Returns the claim, which
    /// is also the id of the row it just published.
    ///
    /// The seed is what a handoff adds and a New Session leaves empty (#513): a folder other than
    /// the Project's, and a prompt to open on. Everything after that is identical, deliberately —
    /// the second half of handing off calls this path rather than a second one beside it.
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

        let claim = ownership.claim(cwd: cwd)
        do {
            let invitation = try companion?.invite(claim, gatedBy: permissions?.grant(claim))
            let launch = try await spawnServices.launcher.launch(
                cli: cli,
                cwd: cwd,
                companion: invitation,
            )
            let process = try host.start(
                seed.opening.map(launch.opening) ?? launch,
                events: events(for: claim),
            )
            terminals.adopt(claim, process: process)
            spawns[claim] = AgentSpawn(
                claim: claim,
                cli: cli,
                cwd: cwd,
                spawnedAtMs: Date().epochMs,
            )
            return claim
        } catch {
            // Nothing started, so nothing is owned. Releasing keeps the window from covering an
            // agent somebody else starts in this folder a moment later.
            ownership.release(claim)
            companion?.withdraw(claim)
            permissions?.withdraw(claim)
            throw error
        }
    }

    /// Every PTY this Hub owns, ended, and every channel with them. What window close and app quit
    /// call: an agent Argo started must not outlive the Argo that started it.
    func endOwnedSessions() {
        terminals.terminateAll()
        companion?.withdrawAll()
        permissions?.withdrawAll()
        for claim in ownership.liveClaims {
            ownership.release(claim)
        }
    }

    private func events(for claim: SessionOwnership.ClaimID) -> AgentProcessEvents {
        AgentProcessEvents(
            onData: { [weak self] chunk in self?.terminals.received(chunk, from: claim) },
            onExit: { [weak self] code in self?.ptyEnded(claim, exitCode: code) },
        )
    }

    /// The PTY is gone. Ownership cannot be re-adopted, so the claim closes and the Session demotes
    /// to `orphaned` — observation-only, steering unrecoverable — rather than standing managed over
    /// a PTY that is not there.
    ///
    /// A row still standing under the claim's own id is the one no observation can ever reach: the
    /// CLI never wrote a record, so no sweep will correct it. It says which way it went and ends,
    /// rather than sitting managed-and-idle forever.
    private func ptyEnded(_ claim: SessionOwnership.ClaimID, exitCode: Int32?) {
        ownership.release(claim)
        terminals.drop(claim)
        companion?.withdraw(claim)
        permissions?.withdraw(claim)
        guard var spawn = spawns[claim] else { return }
        spawn.exit = AgentSpawn.Exit(code: exitCode, atMs: Date().epochMs)
        spawns[claim] = spawn
    }
}

@MainActor
extension Hub {
    /// Retire the row a spawn published, now that the record it turned out to be has appeared.
    ///
    /// The binding is what makes this safe to call on every batch: a Session binds to at most one
    /// claim, once, so a re-observation reports nothing and the row cannot be retired twice — nor
    /// can the observed Session be re-keyed to the claim's id, which would break every link made
    /// against the id the CLI chose.
    func reconcileSpawns() {
        for session in join.sessions {
            guard let claim = ownership.bind(
                sessionID: session.id,
                cwd: session.cwd,
                startedAtMs: session.startedAtMs,
            ) else { continue }
            spawns.removeValue(forKey: claim)
            // The one moment a written handoff link can stop naming a claim and name a Session
            // instead. Here rather than in the store, because binding happens once per claim and
            // this is the call that knows it just did (#513).
            nameChain(claim: claim, as: session.id)
        }
    }

    /// Fold one CONVENTION-tier report into what this claim's Session has said.
    func record(_ fact: CompanionFact, for claim: SessionOwnership.ClaimID) {
        var report = companionReports[claim] ?? CompanionReport()
        report.apply(fact)
        companionReports[claim] = report
    }
}

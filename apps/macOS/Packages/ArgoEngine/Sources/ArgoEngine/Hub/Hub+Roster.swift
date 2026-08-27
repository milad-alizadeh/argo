/// What the Hub publishes about its own reading: which transcripts it is on, whether it is reading
/// anything at all, and the roster those two facts stitch into. Every one is derived on READ, so no
/// second copy can fall out of step with the state it came from.
@MainActor
public extension Hub {
    /// What is being read, per transcript, in the order the transcripts joined the set.
    var observations: [HubObservation] {
        watch.observations
    }

    var connection: HubConnection {
        watch.connection
    }

    /// The roster, with what Argo knows from OUTSIDE the transcripts folded in as it is published.
    /// Spawned Sessions share the list and the sort key: their rows exist before any transcript
    /// does (#361) and stand down once the record they turned out to be is bound to their claim.
    var sessions: [HubSession] {
        HubSessionChain.ordered(watch.sessions.map(observed) + provisionalSessions)
    }
}

@MainActor
extension Hub {
    /// One Session by id, off that same roster — so a caller reading one row and a caller reading
    /// the list can never disagree about it.
    func session(id: String) -> HubSession? {
        sessions.first { $0.id == id }
    }

    /// One Session as the roster publishes it: what its transcript said, plus what Argo established
    /// about the process behind it and its own claim on it.
    func observed(_ session: HubSession) -> HubSession {
        var published = session
        published.liveness = readings.liveness(
            inCwd: session.cwd,
            // The records' own times where they carry any, and the file's last write behind them —
            // a transcript that timestamps nothing still says when it was written to.
            lastActivityAtMs: session.lastSeenAtMs,
        )
        published.provenance = ownership.provenance(sessionID: session.id)
        // A spawn already knows its own program; a swept record's is the store it came out of.
        published.cli = session.cli ?? discovery.cli
        published.workspace = readings.workspace(inCwd: session.cwd)
        // Everything Argo established outside the transcript, in ONE lookup (#634). Through the
        // claim rather than the Session id: the claim is what the channels are keyed by, exists
        // before the CLI has picked an id, and outlives the reconciliation that gave the row one.
        let facts = claims.facts(for: ownership.boundClaim(ofSessionID: session.id))
        published.convention = facts.report
        // The oldest waiting Permission: prompts are answered one at a time, and the first one
        // raised is the one the agent is blocked on.
        published.permission = facts.waiting.first
        // The oldest waiting question, for the reason above: questions are answered one at a time.
        published.ask = facts.asking.first
        published.standingAllows = facts.standing
        published.expiredPermissions = facts.expiries
        published.driveStatus = facts.driveStatus
        // The rung falls back to the row's own, which is where a spawn's lives until something
        // sets a second one.
        published.modeSet = facts.modeSet ?? session.modeSet
        published.lostTurn = facts.lostTurn
        // Read through the claim rather than as recorded: the fresh row is re-keyed to its CLI's
        // own id the moment its record appears, and the link has to follow it there.
        published.handedOffTo = handoff.edge(of: session.id).map(ownership.rowID(ofClaim:))
        return published
    }

    /// The spawned rows belonging to the Project this Hub is currently on. Spawns outlive a
    /// Project switch and keep their PTYs, so they need scoping the re-pointed join gives the rest.
    private var provisionalSessions: [HubSession] {
        spawns.values
            .filter { ProjectScope.contains(cwd: $0.cwd, projectURL: project.url) }
            .map { observed(HubSession(spawn: $0)) }
    }
}

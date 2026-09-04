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
    ///
    /// Folded once per move of `rosterStamp` rather than once per read: the fold is every Session
    /// decorated and then sorted, and the app reads this several times a scene pass (ADR-0028 Rule
    /// 1).
    var sessions: [HubSession] {
        roster.sessions(at: rosterStamp, folding: folded)
    }
}

@MainActor
public extension Hub {
    /// Read one Session's record WHOLE, because it has been selected.
    ///
    /// The sweep admitted every transcript on a bounded read of its two ends, which is what draws
    /// the roster (`TranscriptExcerpt`); the feed needs the stretch that read skipped. Held
    /// afterwards, so coming back to a Session is a lookup and never a second drain of its file
    /// (`WholeReadings`).
    ///
    /// Safe to call on every click, including a second click on the row already open: a Session
    /// already held reads nothing. Takes the selection AS THE COCKPIT HOLDS IT, optional and all —
    /// nothing selected reads nothing, and a caller should not have to spell that.
    func readSelected(sessionID: String?) async {
        guard let sessionID else { return }
        await watch.readWhole(rowID: sessionID)
    }
}

@MainActor
extension Hub {
    /// One Session by id, off that same roster — so a caller reading one row and a caller reading
    /// the list can never disagree about it.
    func session(id: String) -> HubSession? {
        roster.session(id: id, at: rosterStamp, folding: folded)
    }

    /// The fold itself, run only where the stamp below says an input has moved.
    private func folded() -> [HubSession] {
        HubSessionChain.ordered(watch.sessions.map(observed) + provisionalSessions)
    }

    /// Every input the fold reads, and all of them: the join it folds, the three ledgers and the
    /// world readings `observed(_:)` decorates each row from, and the two the Hub holds itself.
    /// The one thing the fold reads that is absent is `discovery.cli`, which is a `let`.
    ///
    /// Reading the four observed counters here is also what keeps the cockpit redrawing — a memo
    /// hit touches no other observed property, so this is where a view's dependency on the roster
    /// is registered. `ownership` is not observed and never was: what a claim changes about a row
    /// has always arrived beside a spawn or a claim-ledger publish.
    private var rosterStamp: HubRosterStamp {
        HubRosterStamp(
            join: watch.joinRevision,
            readings: readings.revision,
            claims: claims.revision,
            ownership: ownership.revision,
            handoff: handoff.revision,
            spawns: spawns,
            project: project,
        )
    }

    /// What follows a batch landing in the join: the spawned rows it may retire, and the folders it
    /// has just named.
    ///
    /// Spelling them here is what keeps the readings' table from COSTING a Session its liveness.
    /// Before that table existed every read resolved the folder live, so a Session that appeared
    /// between sweeps matched its process at once; held answers alone, it would match nothing until
    /// the next sweep. This closes the window the table opens (#959).
    ///
    /// The folders are taken off the JOIN rather than off the roster below — the roster is a fold
    /// over these same readings, and asking it here would rebuild it on every batch. A spawned row
    /// is in neither: `spawnSession` spells its folder itself, for the same reason and at the one
    /// moment it is known.
    func didApply() async {
        reconcileSpawns()
        await readings.spell(
            theProjectRootAnd: watch.sessions.compactMap(\.cwd),
            settling: .foldersNotYetSpelled,
        )
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
        // The tier applied here and not in the reader: git answers the same counts whoever is in
        // the folder, and how Argo knows an AGENT is there is the row's provenance.
        published.workspace = readings.workspace(inCwd: session.cwd)?
            .known(via: published.provenance)
        // Everything Argo established outside the transcript, in ONE lookup (#634). Through the
        // claim rather than the Session id: the claim is what the channels are keyed by, exists
        // before the CLI has picked an id, and outlives the reconciliation that gave the row one.
        let facts = claims.facts(for: ownership.boundClaim(ofSessionID: session.id))
        published.convention = facts.report
        // Off the CHANNEL's own log, never off the posture above: a reading taken from
        // `managed`-ness would have every orphaned Session claiming a live channel (#493).
        published.companionChannel = facts.companionLiveness
        // The oldest waiting Permission: prompts are answered one at a time, and the first one
        // raised is the one the agent is blocked on.
        published.permission = facts.waiting.first
        // The oldest waiting question, for the reason above: questions are answered one at a time.
        published.ask = facts.asking.first
        published.standingAllows = facts.standing
        published.expiredPermissions = facts.expiries
        published.driveStatus = facts.driveStatus
        published.submittedTurn = facts.submittedTurn
        // The rung falls back to the row's own, which is where a spawn's lives until something
        // sets a second one.
        published.modeSet = facts.modeSet ?? session.modeSet
        // And the pair it was started at, which falls back the same way (#1175).
        published.launchedRun = facts.run ?? session.launchedRun
        // The ticket falls back to the row's own for the reason the rung does: a provisional row
        // carries what it was spawned with until the claim is bound to a Session id (#872). And
        // then to the durable ledger, which is all a relaunch has left: both readings above die
        // with the process that established them, and without this one every spawn-seeded link
        // degrades to the branch guess on the next launch (#894).
        published.ticket = facts.ticket ?? session.ticket
            ?? ownership.spawnTicket(ofSessionID: session.id)
        published.lostTurn = facts.lostTurn
        // Read through the claim rather than as recorded: the fresh row is re-keyed to its CLI's
        // own id the moment its record appears, and the link has to follow it there.
        published.handedOffTo = handoff.edge(of: session.id).map(ownership.rowID(ofClaim:))
        return published
    }

    /// The spawned rows belonging to the Project this Hub is currently on. Spawns outlive a
    /// Project switch and keep their PTYs, so they need scoping the re-pointed join gives the rest.
    private var provisionalSessions: [HubSession] {
        let root = readings.spelled(project.url.path)
        return spawns.values
            .filter { ProjectScope.contains(cwd: readings.spelled($0.cwd), projectRoot: root) }
            .map { observed(HubSession(spawn: $0)) }
    }
}

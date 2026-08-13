/// What the Hub publishes about its own reading: which transcripts it is on, whether it is reading
/// anything at all, and the roster those two facts stitch into. Every one is derived on READ, so no
/// second copy can fall out of step with the state it came from.
@MainActor
public extension Hub {
    /// What is being read, per transcript, in the order the transcripts joined the set. A tail's
    /// presence in the table IS its liveness, so there is no second number to fall out of step.
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

    /// The roster, with what Argo knows from OUTSIDE the transcripts folded in as it is published.
    /// Spawned Sessions share the list and the sort key: their rows exist before any transcript
    /// does (#361) and stand down once the record they turned out to be is bound to their claim.
    var sessions: [HubSession] {
        HubSessionChain.ordered(join.sessions.map(observed) + provisionalSessions)
    }
}

@MainActor
extension Hub {
    /// One Session by id, off that same roster — so a caller reading one row and a caller reading
    /// the list can never disagree about it.
    func session(id: String) -> HubSession? {
        sessions.first { $0.id == id }
    }

    /// The spawned rows belonging to the Project this Hub is currently on. Spawns outlive a
    /// Project switch and keep their PTYs, so they need scoping the re-pointed join gives the rest.
    private var provisionalSessions: [HubSession] {
        spawns.values
            .filter { ProjectScope.contains(cwd: $0.cwd, projectURL: project.url) }
            .map { observed(HubSession(spawn: $0)) }
    }
}

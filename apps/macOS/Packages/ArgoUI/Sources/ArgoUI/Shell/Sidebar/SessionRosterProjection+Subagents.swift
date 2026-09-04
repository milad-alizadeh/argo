import ArgoEngine

/// What the leading column draws under the state dot for what runs under a Session
/// (`cockpit-roster-row.md`, `SubagentDots`). Four readings, and each is a different fact.
///
/// THREE of the rail's four facts, never the fourth: this reads the Session's own record through
/// `FeedAgents.all(in:of:within:)`, the same list `FeedAgentReader.agents(in:)` reads before its
/// `told(_:)` step. It never calls `told`, because that step answers off a Subagent's OWN file,
/// growing —
/// and that reading exists only for whichever Session the deck has open (`Hub.subagentGrewAtMs`,
/// behind `FeedAgentReader`), never for every row on the roster at once. A row not currently open
/// can therefore lag the rail by exactly the gap #1269 was written to close: an open delegation
/// past `DelegationCeiling` that its child is still visibly writing reads `.unresolved` here and
/// `.running` on the rail, until the row is opened and the fourth fact reaches it too.
extension SessionRosterProjection {
    enum SubagentReading: Hashable, Sendable {
        /// Delegated nothing at all.
        case none
        /// This many Subagents running right now — the rail's own count
        /// (`FeedAgents.running(of:)`). The two must never disagree: a roster indicator that
        /// repeats #1269 repeats it on every row at once.
        case running(Int)
        /// Delegated, and every one of them is home.
        case landed
        /// An open delegation Argo cannot resolve (#1076).
        case unresolved
    }

    /// One Session's reading, or `nil` where its own state is one Argo cannot place: a Session
    /// Argo cannot place cannot be claimed to be delegating either (rule 5).
    static func subagents(
        of session: CockpitPresentation.Session, in events: [TranscriptEvent],
    )
        -> SubagentReading? {
        guard SessionState.role(for: session.status) != nil else { return nil }
        return reading(for: delegatedAgents(
            in: events,
            of: DelegatingSession.of(session.status),
            within: FeedPath(cwd: session.workspaceLocation),
        ))
    }

    /// A fold's own reading: the running dots of every run it hides, pooled under the same
    /// ceiling (rule 9). Never the other three readings — landed and unresolved are claims about
    /// ONE run, and pooling them into one mark would be a claim about the others a fold declines
    /// to make anywhere else.
    static func foldedSubagents(of sessions: [CockpitPresentation.Session]) -> SubagentReading {
        let running = sessions.reduce(into: 0) { total, session in
            guard SessionState.role(for: session.status) != nil else { return }
            total += FeedAgents.running(of: delegatedAgents(
                in: session.events,
                of: DelegatingSession.of(session.status),
                within: FeedPath(cwd: session.workspaceLocation),
            ))
        }
        return running > 0 ? .running(running) : .none
    }

    /// Off the STREAM and not the feed's rows (#1394). The roster needs the delegate calls, and no
    /// fold in `FeedProjection` can reach one — so building a whole reading to find them was about
    /// thirty times the work, once per row, on every pass.
    private static func delegatedAgents(
        in events: [TranscriptEvent], of liveness: DelegatingSession, within path: FeedPath,
    )
        -> [FeedAgent] {
        FeedAgents.all(in: events, of: liveness, within: path)
    }

    private static func reading(for agents: [FeedAgent]) -> SubagentReading {
        guard !agents.isEmpty else { return .none }
        let running = FeedAgents.running(of: agents)
        guard running == 0 else { return .running(running) }
        return agents.contains { $0.activity == .unknown } ? .unresolved : .landed
    }
}

import ArgoEngine

/// What the leading column draws under the state dot for what runs under a Session
/// (`cockpit-roster-row.md`, `SubagentDots`). Four readings, and each is a different fact.
///
/// ALL FOUR of the rail's facts, and the fourth is why this file has a parameter (#1572). Three of
/// them come off the Session's own record through `FeedAgents.all(in:of:within:)`, the same list
/// `FeedAgentReader.agents(in:)` reads before its `told(_:)` step. The fourth answers off a
/// Subagent's OWN file, growing, and the record cannot hold it: a parent that delegated its whole
/// fan-out and is now WAITING on it writes nothing, so its status reads `idle` and every child
/// under it degrades to `.unknown` — the row drawing an outline pip over two agents the rail is
/// drawing green.
///
/// Argo tails a Subagent's file for every transcript in the working set (`SubagentTails`), so the
/// evidence is there for every row. Asking for it wakes the asker whenever any fan-out writes
/// (#858), and the sidebar pays that once per pass. `SubagentGrowth.unwatched` is the three-fact
/// reading, and is what a caller holding no Hub gets.
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
        of session: CockpitPresentation.Session,
        in events: [TranscriptEvent],
        against watch: Watch,
    )
        -> SubagentReading? {
        guard SessionState.role(for: session.status) != nil else { return nil }
        return reading(for: agents(of: session, in: events, against: watch))
    }

    /// A fold's own reading: the running dots of every run it hides, pooled under the same
    /// ceiling (rule 9). Never the other three readings — landed and unresolved are claims about
    /// ONE run, and pooling them into one mark would be a claim about the others a fold declines
    /// to make anywhere else.
    static func foldedSubagents(
        of sessions: [CockpitPresentation.Session], against watch: Watch,
    )
        -> SubagentReading {
        let running = sessions.reduce(into: 0) { total, session in
            guard SessionState.role(for: session.status) != nil else { return }
            total += FeedAgents.running(
                of: agents(of: session, in: session.events, against: watch),
            )
        }
        return running > 0 ? .running(running) : .none
    }

    /// One Session's delegations, told by all four facts — the one walk both readings above take.
    ///
    /// Off the STREAM and not the feed's rows (#1394). The roster needs the delegate calls, and no
    /// fold in `FeedProjection` can reach one — so building a whole reading to find them was about
    /// thirty times the work, once per row, on every pass.
    private static func agents(
        of session: CockpitPresentation.Session,
        in events: [TranscriptEvent],
        against watch: Watch,
    )
        -> [FeedAgent] {
        watch.growth.told(
            FeedAgents.all(
                in: events,
                of: DelegatingSession.of(session.status),
                within: FeedPath(cwd: session.workspaceLocation),
            ),
            at: watch.nowMs,
        )
    }

    private static func reading(for agents: [FeedAgent]) -> SubagentReading {
        guard !agents.isEmpty else { return .none }
        let running = FeedAgents.running(of: agents)
        guard running == 0 else { return .running(running) }
        return agents.contains { $0.activity == .unknown } ? .unresolved : .landed
    }
}

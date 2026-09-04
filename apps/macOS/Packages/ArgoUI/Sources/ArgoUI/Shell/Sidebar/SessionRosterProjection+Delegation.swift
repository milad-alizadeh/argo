import ArgoEngine
import Foundation

/// What the roster's leading column says runs UNDER a Session (#1344, `cockpit-roster-row.md`).
extension SessionRosterProjection {
    /// The four readings the column draws, and each is a different fact. `none` and `spent` are
    /// the pair that look alike and are not — see `SubagentDots`, which draws them.
    package enum Delegation: Equatable, Sendable {
        /// Nothing was handed over, or nothing may be claimed about what was.
        case none
        /// This many are working. The ceiling and the figure past it belong to the view.
        case running(Int)
        /// Delegated, and every one of them is home.
        case spent
        /// An open delegation Argo cannot resolve (#1076).
        case unresolved

        /// What a screen reader hears, which the column spends on marks it has no way to see.
        var spoken: String? {
            switch self {
            case .none: nil
            case let .running(count): "\(count) running under it"
            case .spent: "Delegated, all landed"
            case .unresolved: "Delegating, and Argo cannot say how many"
            }
        }
    }

    /// The Subagents of one Session, as the Agents rail reads them — the rail's own list through
    /// the rail's own rule (`FeedAgents`), so the two surfaces cannot disagree about one Session.
    ///
    /// **Empty for a Session whose OWN state Argo cannot place** — its state's outline already
    /// carries the whole claim. Emptied here rather than at the reading below, so a fold cannot
    /// pick the claim back up by joining the lists.
    static func subagents(
        of session: CockpitPresentation.Session,
        in events: [TranscriptEvent],
        writing: (String) -> SubagentWriting,
        nowMs: Int,
    )
        -> [FeedAgent] {
        guard SessionState.role(for: session.status) != nil else { return [] }
        return FeedAgents.told(
            FeedAgents.all(
                in: events,
                of: DelegatingSession.of(session.status),
                within: FeedPath(cwd: session.workspaceLocation),
            ),
            writing: writing,
            at: nowMs,
        )
    }

    /// What a list of Subagents draws in the column. One rule at both levels: a Session reads its
    /// own list, and a fold reads the lists it hides joined, which is what makes rule 9's "a fold
    /// sums" structural rather than a second piece of arithmetic.
    ///
    /// **Argo counts what it can place, and says so only about what it cannot** — the amendment
    /// `cockpit-roster-row.md` rule 5 carries (#1344). The running count comes first because those
    /// are the ones Argo has evidence for: the record answered them, or the child's own file is
    /// growing (#1269). `finished` is never claimed on absence of evidence.
    static func reading(of agents: [FeedAgent]) -> Delegation {
        guard !agents.isEmpty else { return .none }
        let running = FeedAgents.running(of: agents)
        if running > 0 {
            return .running(running)
        }
        guard !agents.contains(where: { $0.activity == .unknown }) else { return .unresolved }
        return .spent
    }
}

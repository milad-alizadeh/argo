import ArgoEngine
import Foundation

/// What the roster's leading column says runs UNDER a Session (#1344, `cockpit-roster-row.md`).
extension SessionRosterProjection {
    /// The four readings the column draws, and each is a different fact.
    ///
    /// `none` and `spent` are the two that look alike and are not: never delegated draws nothing at
    /// all, where delegated-and-all-home draws a dash. A column that answered both with a blank
    /// would say a Session that fanned out and gathered everyone back never fanned out.
    package enum Delegation: Equatable, Sendable {
        /// Nothing was handed over, or nothing may be claimed about what was.
        case none
        /// This many are working. The ceiling and the figure past it belong to the view.
        case running(Int)
        /// Delegated, and every one of them is home.
        case spent
        /// An open delegation Argo cannot resolve (#1076). Never a number: `finished` here is the
        /// untruth #1269 was written for.
        case unresolved
    }

    /// The Subagents of one Session, as the Agents rail reads them — the rail's own list through
    /// the rail's own rule (`FeedAgents`), so the two surfaces cannot disagree about one Session.
    ///
    /// **Empty for a Session whose OWN state Argo cannot place.** A Session Argo cannot place
    /// cannot be claimed to be delegating either, and the state's outline already carries the whole
    /// claim — a second outline under it reads as a second dot. Emptied HERE rather than at the
    /// reading below, so a fold cannot pick the claim back up by joining the lists.
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
    /// own list, and a fold reads the lists it hides joined — which is what makes rule 9's "a fold
    /// sums" structural rather than a second piece of arithmetic that could drift from this one.
    ///
    /// **Argo counts what it can place, and says so only about what it cannot.** The running count
    /// comes first because those are the ones Argo has evidence for — the record answered them, or
    /// the child's own file is growing (#1269). The outline is what is left when it can place
    /// nothing: rule 5's "never a number" is about a reading with no number in it, not about
    /// suppressing one Argo actually has. Reading it the other way would put an idle Session's two
    /// silent children in front of the one Argo is watching write, which is #1269 pointed sideways.
    ///
    /// Then the dash, then nothing. `finished` is never claimed on absence of evidence.
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

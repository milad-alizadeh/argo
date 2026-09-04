import ArgoEngine

/// Whether the Session that delegated a Subagent can still be driving it (`CONTEXT.md` L2 ·
/// Session status) — the second half of every "still running" claim the rail makes.
///
/// A Subagent cannot be running when the Session that delegated it is not: the delegating process
/// is what would write the report that ends the call, so a delegation left pending by a Session
/// nobody is running is a record nothing will ever close (#1076).
package enum DelegatingSession: Equatable, Sendable {
    case running
    case notRunning
    /// The Session writes nothing while it waits, so its record says the same thing about a live
    /// delegation and a dead one. Not a third status — a third READING of the statuses there are.
    case undecided

    /// DERIVED, and NOT `status == .running`.
    ///
    /// **degrade-down governs ambiguity, and these three are not ambiguous.** A Session blocked on
    /// a permission prompt or an `AskUserQuestion` is demonstrably alive — its process is there,
    /// and its Subagents genuinely are still out — so reading them quiet is a false NEGATIVE
    /// rather than a careful reading: the same class of lie this type removes, pointed the other
    /// way. The honest floor is "the Session cannot be driving work", and a Session waiting on the
    /// READER can.
    ///
    /// `idle` is where the line falls, and it is the hard case: a backgrounded Subagent can outlive
    /// its parent's Turn, so an idle Session may really have one out — and a parent that delegated
    /// its whole fan-out and is now waiting on it is idle for exactly as long as they work. Its
    /// open delegation is indistinguishable in the record from a dead one's, which is the whole of
    /// #1076, so it reads `undecided`: NOT `notRunning`, which was this type saying `finished` on
    /// no evidence and is the `0 running` the reader was shown over a moving feed (#1269). What
    /// settles it is evidence the record does not hold — `SubagentWriting`.
    ///
    /// `starting` has written nothing to delegate; `stopped`, `ended` and `unknown` are the
    /// Sessions #1076 was written from, and stay `notRunning` — a Session that has gone cannot be
    /// driving anything, and there is no gap in that to be undecided about.
    ///
    /// `nil` — a room that resolved no Session — is the absence of evidence, and quiet with the
    /// rest. Exhaustive on purpose: a status added to the domain fails the BUILD here rather than
    /// inheriting the boundary of whichever neighbour it was declared beside.
    static func of(_ status: SessionStatus?) -> DelegatingSession {
        switch status {
        case .running, .permission, .asking: .running
        case .idle: .undecided
        case .starting, .stopped, .ended, .unknown, .none: .notRunning
        }
    }

    var isRunning: Bool {
        self == .running
    }
}

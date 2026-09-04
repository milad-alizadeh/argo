import ArgoDesign

/// What the rail claims about one Subagent: working, landed, or a state Argo cannot establish.
///
/// THREE and not two, because a `Bool` has to answer every reading, so every gap in the evidence
/// became `finished` by default — and the rail said `0 running` over a feed the reader could open
/// and watch move (#1269). The honesty tier owes an `unknown` here the same way the roster's dot
/// does: `SessionStateIndicator` already draws it, as an outline rather than a colour.
///
/// One value per chip, read by the dots, the count, the list's split and the clock — so no surface
/// can answer this question its own way (#1204).
package enum AgentActivity: Equatable, Sendable {
    /// Argo can say this Subagent is working.
    case running
    /// Argo can say this Subagent is not: the record closed the delegation, or the Session that
    /// would have to be driving it has gone, or the report is past the ceiling that says it was
    /// lost.
    case finished
    /// Argo cannot say. The delegation is open, and the only Session that could close it is one
    /// that writes nothing while it waits — so the record holds a live Subagent and a dead one in
    /// exactly the same shape (#1076). degrade-down does NOT make that `finished`: quieter is not
    /// the same as false, and `finished` is a claim.
    case unknown

    /// Whether the rail counts this one. The count line says `running`, so only the first is it.
    var isRunning: Bool {
        self == .running
    }

    /// The dot, in one place, so the rail's two forms cannot draw one chip two ways. `nil` is the
    /// honest unknown `SessionStateIndicator` already carries — an outline, because the visual
    /// contract has no colour for "we cannot say" and inventing one would be the claim again.
    var dot: ArgoOperationalState? {
        switch self {
        case .running: .running
        case .finished: .idle
        case .unknown: nil
        }
    }
}

/// What a Session is doing, rolled up (CONTEXT.md, "Session status"). Always DERIVED, never
/// stored, and carrying its own `unknown` so a status that cannot be established honestly has
/// somewhere to go (ADR-0008's degrade-down rule).
public enum SessionStatus: Sendable, Equatable, CaseIterable {
    /// A Turn is in progress.
    case running
    /// Blocked on an agent `request_permission` prompt. DIRECT, managed only.
    case permission
    /// Blocked on a structured `AskUserQuestion`.
    case asking
    /// A Turn ended `end_turn`, or there is no live signal. Includes an agent's free-form question,
    /// which is indistinguishable from idle in the record.
    case idle
    /// A Turn ended `max_tokens`, `max_turn_requests` or `refusal`.
    case stopped
    /// The Session terminated.
    case ended
    /// Nothing establishes a status. Not a state the Session is in — a state we cannot claim.
    case unknown
}

public extension SessionStatus {
    /// The status the observed Turn boundaries imply, and nothing beyond them.
    ///
    /// `permission` and `asking` are unreachable here by construction: both are managed-only
    /// signals that arrive over the companion channel, and a transcript that cannot carry them
    /// must not be read as though it had. A Session with no Turn boundary observed at all is
    /// `unknown` rather than `idle` — nothing observed is a different claim from observed to be
    /// quiet.
    ///
    /// `running` means the last Turn observed was never closed. Liveness (process match + mtime)
    /// is not observed yet, so a transcript whose writer died mid-Turn reads as running until it
    /// is: CONTEXT.md's "no live signal → idle" needs that signal to exist before it can fire.
    ///
    /// A cancelled TURN reads `idle`, not `ended`: interrupting a run leaves the Session sitting
    /// there waiting for the next prompt. `ended` is the Session terminating, which is a fact
    /// about the process rather than about any Turn in it.
    static func observed(turnOpen: Bool, lastStop: StopReason?) -> SessionStatus {
        guard !turnOpen else { return .running }
        return switch lastStop {
        case .endTurn, .cancelled: .idle
        case .maxTokens, .maxTurnRequests, .refusal: .stopped
        case .unknown, .none: .unknown
        }
    }
}

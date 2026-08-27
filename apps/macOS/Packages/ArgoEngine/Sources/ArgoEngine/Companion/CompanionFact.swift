import Foundation

/// One thing that arrived over the companion channel, already read into the domain.
///
/// The wire shape stops here: nothing downstream of this parses JSON, and nothing upstream of it
/// knows what a `SessionStatus` is. That is the same boundary the transcript reader draws, for the
/// same reason — the untrusted input is read once, into types.
enum CompanionFact: Sendable, Equatable {
    case status(SessionStatus)
    case ask(CompanionAsk)
    case outcome(CompanionOutcome)
}

extension CompanionReport {
    /// Fold one report into what this Session has said so far.
    ///
    /// A status replaces the previous one — it is a standing claim about now, not a log. An ask
    /// likewise: an agent that asks again has moved on from the first question. Outcomes
    /// accumulate, because "what got done" is the one thing here that is cumulative.
    mutating func apply(_ fact: CompanionFact) {
        switch fact {
        case let .status(status):
            self.status = status
            // A status that is no longer `asking` is the agent saying the question is behind it.
            if status != .asking {
                pendingAsk = nil
            }
        case let .ask(ask):
            pendingAsk = ask
            status = .asking
        case let .outcome(outcome):
            outcomes.append(outcome)
        }
    }

    /// The channel is gone, so the claims that stood on it go: the roster falls back to the DERIVED
    /// reading of the transcript rather than to a `running` nothing is behind any more (#799). The
    /// other half of `apply`'s rule — outcomes are cumulative, so they stay.
    mutating func channelClosed() {
        status = nil
        pendingAsk = nil
    }
}

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
    case ready(CompanionReady)
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
            // A standing claim about now, retired by the next claim about now: the agent that
            // reports what it is doing without repeating "ready" has moved past it (#1335) — the
            // same reading `pendingAsk` gets from a status that is not `asking` any more.
            readyToShip = nil
        case let .ask(ask):
            pendingAsk = ask
            status = .asking
        case let .outcome(outcome):
            outcomes.append(outcome)
        case let .ready(ready):
            readyToShip = ready
        }
    }

    /// Somebody answered — a Turn Argo typed at this Session's PTY (#1203).
    ///
    /// #1205 drew the question and said the answer goes in the composer. This is the other half of
    /// that sentence: the act it names has to retire the question, because nothing obliges the
    /// agent to report again afterwards. Left standing, the card stays amber and the roster keeps
    /// `NEEDS INPUT` for the rest of the Session — over a question the reader has already answered.
    ///
    /// The STATUS goes with it, and it has to: a cleared `pendingAsk` under a standing `asking`
    /// claim is the roster telling the reader to answer something no surface can show them, which
    /// is the fault #1205 fixed. Cleared rather than replaced with a word of Argo's own — what the
    /// Session is doing now is for the tiers below to read, and this one has nothing left to say.
    ///
    /// One limit, stated rather than papered over: a Turn the CLI never heard (#682) retires the
    /// question all the same. The words go back to the composer where they were typed, and the
    /// agent's next report is what puts a question back — Argo does not re-raise one on its own.
    mutating func answered() {
        pendingAsk = nil
        if status == .asking {
            status = nil
        }
    }

    /// The channel is gone, so the claims that stood on it go: the roster falls back to the DERIVED
    /// reading of the transcript rather than to a `running` nothing is behind any more (#799). The
    /// other half of `apply`'s rule — outcomes are cumulative, so they stay.
    mutating func channelClosed() {
        status = nil
        pendingAsk = nil
        readyToShip = nil
    }
}

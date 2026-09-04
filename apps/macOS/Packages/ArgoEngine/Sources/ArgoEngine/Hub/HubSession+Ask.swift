extension HubSession {
    /// What the agent has said over the companion channel that the channel STILL stands behind.
    ///
    /// `CompanionLiveness.dropped` says the tier stops there, and this is where it stops: a status
    /// and an unanswered question are both standing claims about NOW, and a client that held the
    /// channel and hung up leaves nothing behind either of them. `CompanionReport.channelClosed`
    /// is the same rule at the other moment — it runs when the CLAIM is withdrawn, which is the
    /// PTY dying, and a channel lost under a living PTY reaches no withdrawal.
    ///
    /// Read HERE rather than at each of the two readers, so the roster's badge and the feed's row
    /// cannot disagree about whether the channel is still speaking: a status left at `asking` over
    /// a question no longer drawn is #1205's own fault, narrowed rather than fixed.
    ///
    /// Only `dropped` disqualifies. `neverDialled` lost nothing and `notApplicable` is the absence
    /// of a channel to report on, and neither is news that a claim stopped being true.
    var reported: CompanionReport? {
        companionChannel == .dropped ? nil : convention
    }
}

public extension HubSession {
    /// The question this Session's agent raised over the companion plugin and nobody has answered
    /// (#1205) — CONVENTION, and the one fact that carries `CompanionReport.pendingAsk` out of the
    /// package it is folded in.
    ///
    /// Beside `ask` rather than folded into it, and the two never merge: `ask` is a live handle
    /// Argo's own gate is holding, answerable down the socket it came up; this is a claim the agent
    /// made and Argo answered `Recorded` the moment it arrived. A surface handed one where it
    /// expected the other would offer an answer that reaches nobody.
    var companionAsk: CompanionAsk? {
        reported?.pendingAsk
    }
}

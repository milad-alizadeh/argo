public extension HubSession {
    /// The question this Session's agent raised over the companion plugin and nobody has answered
    /// (#1205) — CONVENTION, and the one fact that carries `CompanionReport.pendingAsk` out of the
    /// package it is folded in.
    ///
    /// Beside `ask` rather than folded into it, and the two never merge: `ask` is a live handle
    /// Argo's own gate is holding, answerable down the socket it came up; this is a claim the agent
    /// made and Argo answered `Recorded` the moment it arrived. A surface handed one where it
    /// expected the other would offer an answer that reaches nobody.
    ///
    /// Gated on the CHANNEL, which is `channelClosed`'s rule read at the one moment that call
    /// cannot cover: a claim is withdrawn when its PTY goes, and a channel whose last client hung
    /// up under a living PTY reaches no withdrawal. An unanswered question is a claim about NOW,
    /// so with nothing left to answer over, it stops being one.
    var companionAsk: CompanionAsk? {
        guard companionChannel == .live else { return nil }
        return convention?.pendingAsk
    }
}

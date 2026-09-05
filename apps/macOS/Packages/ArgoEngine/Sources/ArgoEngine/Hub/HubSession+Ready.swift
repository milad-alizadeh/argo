public extension HubSession {
    /// The claim this Session's agent made over the companion plugin that its change is ready
    /// for a pull request (#1335) — CONVENTION, and the one fact that carries
    /// `CompanionReport.readyToShip` out of the package it is folded in.
    ///
    /// `reported` is what disqualifies it once the channel drops, on `companionAsk`'s own terms:
    /// a claim the channel no longer stands behind is not one Argo can keep drawing.
    var readyToShip: CompanionReady? {
        reported?.readyToShip
    }
}

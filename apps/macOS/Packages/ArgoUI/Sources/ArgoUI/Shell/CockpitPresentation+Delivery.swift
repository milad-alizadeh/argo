import ArgoEngine

extension CockpitPresentation.Session.Work.Delivery {
    /// The two facts a branch's own pull request settles together (#1335): the pull request
    /// itself, and whether the Session's companion claim to be ready for one still draws.
    ///
    /// A pull request the host reports **open**, verbatim and never normalized, always wins over
    /// the claim (`cockpit-roster-row.md`, decision 7) — a closed or merged one does not, since a
    /// fresh claim after either is not a lie.
    static func reading(pullRequest: DeliveryPullRequest?, claim: CompanionReady?) -> Self {
        Self(pullRequest: pullRequest, readyToShip: claim != nil && pullRequest?.state != "open")
    }
}

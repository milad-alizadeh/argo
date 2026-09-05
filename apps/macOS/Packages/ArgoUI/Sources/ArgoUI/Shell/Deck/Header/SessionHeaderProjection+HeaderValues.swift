/// What a Header is assembled from — one value per zone it draws (#755, #999). The Header itself
/// stays flat: the views read `header.title` and `header.marks`, and a grouping is how the readings
/// ARRIVE rather than a second shape to draw them through.
extension SessionHeaderProjection.Header {
    /// The header's leading half — the facts that say WHICH Session this is, in the order the
    /// header draws them and `announcement` speaks them.
    struct Identity: Equatable, Sendable {
        let title: String
        let agent: String?
        let issue: IssueRow?
        let checkout: Checkout?
        let marks: [Mark]
        let access: AccessMark?
    }

    /// What the Session has cost: the one instrument on the header, the tab line's whole content
    /// beside it, and the remedy that stands beside that reading and carries its urgency
    /// (`SessionHeaderProjection.Handoff`).
    struct Telemetry: Equatable, Sendable {
        let context: SessionHeaderProjection.Context?
        let spend: String?
        let handoff: SessionHeaderProjection.Handoff?
        /// Whether the **Create PR** control draws (#1335) — a managed Session only
        /// (`cockpit-roster-row.md`, decision 6): an external one has no terminal to type
        /// `/ship` into.
        let showsCreatePullRequest: Bool
    }
}

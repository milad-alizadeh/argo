import ArgoEngine

extension WorkItem {
    /// The type word a chart is one of, folded for case: a tracker spelling it `Prd` names the same
    /// shape as `PRD`. MATCHED and never ranked, on the same terms as a priority word.
    private static let chartType = "prd"

    /// Whether this ticket is the PRD-shaped parent the `CHARTS` group lists — one row per
    /// PRD-shaped parent (`cockpit-work-room.md`).
    ///
    /// The role is the provider's declared TYPE where it carries one, and hierarchy where it does
    /// not — a ticket nobody typed is PRD-shaped if it has children (`CONTEXT.md` L1 · Work Item).
    /// A typed ticket does not fall back: the provider answered, and a parent it calls a `task` is
    /// a task.
    ///
    /// Read off the type and never off a label spelled like one: a `prd` label is somebody's topic,
    /// and the two are different facts even where a repository uses both.
    var isChartShaped: Bool {
        // A PARENT either way. A chart row opens onto a Route, and a Route over a ticket with no
        // children has nothing on its progress axis however the provider typed it.
        guard !children.isEmpty else { return false }
        guard let type else { return true }
        return type.lowercased() == Self.chartType
    }
}

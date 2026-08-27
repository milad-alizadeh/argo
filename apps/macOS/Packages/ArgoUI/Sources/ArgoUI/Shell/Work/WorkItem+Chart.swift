import ArgoEngine

extension WorkItem {
    /// The type word a chart is one of, folded for case: a tracker spelling it `Prd` names the same
    /// shape as `PRD`. MATCHED and never ranked, on the same terms as a priority word.
    private static let chartType = "prd"

    /// Whether this ticket is the PRD-shaped parent the `CHARTS` group lists — one row per
    /// PRD-shaped parent (`cockpit-work-room.md`).
    ///
    /// Read off the provider's own TYPE and never off a label spelled like one: a `prd` label is
    /// somebody's topic, and the two are different facts even where a repository uses both. A
    /// provider that carries no type words therefore has no charts, which is a group that is absent
    /// rather than one reading zero (`CONTEXT.md` L2 · degrade-down).
    var isChartShaped: Bool {
        type?.lowercased() == Self.chartType
    }
}

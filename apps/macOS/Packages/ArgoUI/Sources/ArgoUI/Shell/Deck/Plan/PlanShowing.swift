/// What the deck shows of the plan, in one value.
///
/// The pair travels together for the reason `FeedRowSelection`'s does: every layer between the
/// deck and the pill takes both or neither, and threading them separately put a fourth parameter
/// on views that care about neither.
package struct PlanShowing: Equatable {
    /// The reading, or `nil` when the Session has never reported a plan — in which case nothing is
    /// drawn. A Session with no plan and a Session whose plan is empty are the same absence.
    var plan: PlanReading?
    /// A Session that is not running is not progressing (`cockpit-roster-row.md`, rule 3): the
    /// pill's ring freezes to `progress.still` exactly as the roster's own `PlanBar` does — the
    /// two draw the same fact about the same list.
    var isStill = false
    /// Whether the list is open with nothing pointed at. A specimen's seam; see `PlanPill`.
    var isRevealed = false
    /// Whether the keyboard is on the pill. A specimen's seam beside `isRevealed`; see `PlanPill`.
    var isCursored = false

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(
        plan: PlanReading? = nil,
        isStill: Bool = false,
        isRevealed: Bool = false,
        isCursored: Bool = false,
    ) {
        self.plan = plan
        self.isStill = isStill
        self.isRevealed = isRevealed
        self.isCursored = isCursored
    }
}

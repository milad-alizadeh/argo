/// What the deck shows of the plan, in one value.
///
/// The pair travels together for the reason `FeedRowSelection`'s does: every layer between the
/// deck and the pill takes both or neither, and threading them separately put a fourth parameter
/// on views that care about neither.
struct PlanShowing: Equatable {
    /// The reading, or `nil` when the Session has never reported a plan — in which case nothing is
    /// drawn. A Session with no plan and a Session whose plan is empty are the same absence.
    var plan: PlanReading?
    /// Whether the list is open with nothing pointed at. A specimen's seam; see `PlanPill`.
    var isRevealed = false
    /// Whether the keyboard is on the pill. A specimen's seam beside `isRevealed`, and for its
    /// reason: a still cannot press Tab, and the ring is the state #713 is about.
    var isCursored = false
}

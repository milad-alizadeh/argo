import SwiftUI

/// The plan's pill, over the feed it is deliberately not in.
///
/// The deck rather than the pill alone, because the whole claim of #425 is about WHERE the plan
/// sits: a render of the pill on a bare ground would show a chip, and what is being judged is a
/// chip floating above a dock, over a column of prose that no longer carries the list.
struct PlanSpecimen: View {
    let plan: PlanReading
    /// Whether the list is already open. Hover cannot be reached from a screenshot, so the state
    /// that carries the plan itself needs a way in that is not a gesture.
    var isRevealed = false

    var body: some View {
        InstrumentDeckShell(
            room: .sessions,
            feed: FeedProjection.previewRows,
            showing: PlanShowing(plan: plan, isRevealed: isRevealed),
        )
    }
}

#Preview("Plan specimen — at rest") {
    PlanSpecimen(plan: PlanFixture.working)
        .frame(width: 1000, height: 620)
        .argoAppearance()
}

#Preview("Plan specimen — the list open") {
    PlanSpecimen(plan: PlanFixture.working, isRevealed: true)
        .frame(width: 1000, height: 620)
        .argoAppearance()
}

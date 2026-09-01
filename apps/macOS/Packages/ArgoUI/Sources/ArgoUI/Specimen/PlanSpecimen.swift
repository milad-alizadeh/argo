import AppKit
import SwiftUI

/// The plan's pill, over the feed it is deliberately not in.
///
/// The deck rather than the pill alone, because the whole claim of #425 is about WHERE the plan
/// sits: a render of the pill on a bare ground would show a chip, and what is being judged is a
/// chip floating above a dock, over a column of prose that no longer carries the list.
struct PlanSpecimen: View {
    /// What the focus on the pill arrived by. The ring is gated on the LAST EVENT the app saw, so
    /// the pointer case is a focused pill with no ring (#713). The focus a gesture leaves and never
    /// the gesture itself: a real click also opens the list, and that state is `openPlanPill`.
    enum Arrival {
        case key
        case pointer

        var event: NSEvent.EventType {
            switch self {
            case .key: .keyDown
            case .pointer: .leftMouseDown
            }
        }
    }

    let plan: PlanReading
    /// Whether the list is already open. Hover cannot be reached from a screenshot, so the state
    /// that carries the plan itself needs a way in that is not a gesture.
    var isRevealed = false
    /// How the pill came to be focused, or `nil` for the pill nothing has reached.
    var arrival: Arrival?

    var body: some View {
        InstrumentDeckShell(
            room: .sessions,
            feed: FeedProjection.previewRows,
            showing: PlanShowing(plan: plan, isRevealed: isRevealed, isCursored: arrival != nil),
        )
        // The app's one reader, told the event a still cannot show happening.
        .task {
            if let arrival {
                ArgoFocusVisibility.shared.note(arrival.event)
            }
        }
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

#Preview("Plan specimen — the keyboard on the pill") {
    PlanSpecimen(plan: PlanFixture.working, arrival: .key)
        .frame(width: 1000, height: 620)
        .argoAppearance()
}

#Preview("Plan specimen — the pointer left the focus on the pill") {
    PlanSpecimen(plan: PlanFixture.working, arrival: .pointer)
        .frame(width: 1000, height: 620)
        .argoAppearance()
}

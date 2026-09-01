import AppKit
import SwiftUI

/// The plan's pill, over the feed it is deliberately not in.
///
/// The deck rather than the pill alone, because the whole claim of #425 is about WHERE the plan
/// sits: a render of the pill on a bare ground would show a chip, and what is being judged is a
/// chip floating above a dock, over a column of prose that no longer carries the list.
struct PlanSpecimen: View {
    /// How the keyboard got onto the pill, when it is on it. Both halves of the state have to be
    /// stated, because the ring is gated on the LAST EVENT the app saw: a still of the focused pill
    /// draws a ring only for a reader who arrived by key, and the clicked case is the render that
    /// proves it (#713).
    enum Arrival {
        case key
        case click

        var event: NSEvent.EventType {
            switch self {
            case .key: .keyDown
            case .click: .leftMouseDown
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
        // The app's own reader, told what a still cannot show it happening — the same way
        // `FeedPreview` seeds the feed's cursor.
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

#Preview("Plan specimen — the pill clicked") {
    PlanSpecimen(plan: PlanFixture.working, arrival: .click)
        .frame(width: 1000, height: 620)
        .argoAppearance()
}

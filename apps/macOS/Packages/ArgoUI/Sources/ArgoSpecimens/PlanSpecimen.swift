import AppKit
import ArgoAtoms
import ArgoDesign
import ArgoUI
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
    /// Whether the keyboard is on the pill, ring and all — see `PlanPill.isCursored`.
    var isCursored = false
    /// What floats under the pill, if anything — see `DeckVessel`. A parameter because the state
    /// #1225 was reported in has the composer there: the pill answers to the vessel's own top edge,
    /// and over a bare deck that edge is the deck's foot instead.
    var vessel = DeckVessel.none

    /// What the reader said before this specimen spoke for it. `ArgoFocusVisibility.shared` is
    /// process-wide, so a host rendering a second entry after this one inherits whatever it left.
    @State private var wasOn: Bool?

    var body: some View {
        InstrumentDeckShell(
            room: .sessions,
            feed: FeedProjection.previewRows,
            showing: PlanShowing(plan: plan, isRevealed: isRevealed, isCursored: isCursored),
            vessel: vessel,
        )
        // The app's one reader, told the key a still cannot show being pressed.
        .onAppear {
            guard isCursored else { return }
            wasOn = ArgoFocusVisibility.shared.isOn
            ArgoFocusVisibility.shared.note(.keyDown)
        }
        .onDisappear {
            guard let wasOn else { return }
            ArgoFocusVisibility.shared.note(wasOn ? .keyDown : .leftMouseDown)
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

#Preview("Plan specimen — over the composer") {
    PlanSpecimen(plan: PlanFixture.working, vessel: .composer(ComposerSpecimen.composer))
        .frame(width: 1000, height: 620)
        .argoAppearance()
}

#Preview("Plan specimen — the keyboard on the pill") {
    PlanSpecimen(plan: PlanFixture.working, isCursored: true)
        .frame(width: 1000, height: 620)
        .argoAppearance()
}

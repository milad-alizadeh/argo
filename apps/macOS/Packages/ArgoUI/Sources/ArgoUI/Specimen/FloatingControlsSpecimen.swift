import SwiftUI

/// Everything that floats over the deck, at once: the plan pill, its revealed list, and the way
/// back to the newest line.
///
/// The three of them together rather than one per case, because the claim is about a CATEGORY. One
/// surface drawn in glass proves only that a modifier was applied; three of them over one reading
/// is the only way to see whether the material reads as "these are states you are in" against a
/// deck whose furniture stayed flat.
///
/// The feed is the long one on purpose: the way back is on screen exactly while the reading has
/// stopped following, and a fixture that fits its pane never scrolls away from the end.
struct FloatingControlsSpecimen: View {
    /// Whether to draw it for a reader who asked for no transparency. A specimen's seam: the
    /// fallback is a System Settings toggle away on the machine taking the screenshot, which is
    /// not a state anybody can be asked to render on demand.
    var isFlat = false

    var body: some View {
        InstrumentDeckShell(
            room: .sessions,
            feed: FeedProjection.longRows,
            showing: PlanShowing(plan: PlanFixture.working, isRevealed: true),
        )
        .argoWithoutTransparency(isFlat)
    }
}

#Preview("Floating controls — glass over the deck") {
    FloatingControlsSpecimen()
        .frame(width: 1000, height: 620)
        .argoAppearance()
}

#Preview("Floating controls — the Reduce Transparency fallback") {
    FloatingControlsSpecimen(isFlat: true)
        .frame(width: 1000, height: 620)
        .argoAppearance()
}

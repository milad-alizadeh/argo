import ArgoAtoms
import ArgoDesign
import ArgoUI
import SwiftUI

/// The deck's tabs, in the line they sit in (#404).
///
/// The whole deck rather than the strip alone, for `PlanSpecimen`'s reason: what is being judged
/// is a word and a 2pt rule against a chrome bar with a reading under it, and the same strip on a
/// bare ground would show a tab bar nobody has to place.
struct DeckTabsSpecimen: View {
    /// Whether the keyboard is on the tabs, ring and all — see `DeckTabs`.
    var isCursored = false

    /// What the reader said before this specimen spoke for it. `ArgoFocusVisibility.shared` is
    /// process-wide, so a host rendering a second entry after this one inherits whatever it left.
    @State private var wasOn: Bool?

    var body: some View {
        InstrumentDeckShell(
            room: .sessions,
            feed: FeedProjection.previewRows,
            header: SessionHeaderFixture.header(for: .managed),
        )
        .environment(\.argoDeckTabsCursored, isCursored)
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

#Preview("Deck tabs specimen — at rest") {
    DeckTabsSpecimen()
        .frame(width: 1000, height: 620)
        .argoAppearance()
}

#Preview("Deck tabs specimen — the keyboard on the tabs") {
    DeckTabsSpecimen(isCursored: true)
        .frame(width: 1000, height: 620)
        .argoAppearance()
}

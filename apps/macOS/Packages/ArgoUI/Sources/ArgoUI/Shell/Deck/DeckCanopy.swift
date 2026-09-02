import ArgoAtoms
import ArgoDesign
import SwiftUI

/// The deck's top zone — the Session's identity and the tab line under it — as the lower half of
/// the window's chrome, with the reading passing beneath it (D10, as its 2026-08-12 amendment
/// reads it).
///
/// It takes `argoChromeBar()` and so does the window toolbar directly above it. One material
/// across both is what makes the icons up there and the Session's title down here read as one bar
/// rather than two surfaces meeting, and the single hairline at the foot is where the chrome ends.
package struct DeckCanopy: View {
    /// Absent when nothing is selected. The bar still holds its height — every zone under it is
    /// inset by that height, and a canopy that collapsed would move all of them.
    let header: SessionHeaderProjection.Header?
    /// How far the bar climbs past the safe area — the toolbar region's height, handed down by
    /// `SessionsDeck`. The icon row and this header have to sit on ONE sheet, and a bar stopping
    /// at the safe area leaves the icons on a strip of bare window. Zero where there is no
    /// toolbar over the deck, and everything below draws exactly as before.
    var reach: CGFloat = 0
    /// Hand this Session's work to a fresh one. Inert by default, so a specimen draws the button
    /// and spawns nothing.
    var handOff: () async -> Void = {}

    /// The canopy's own width — which IS the detail pane's, since the canopy spans it. What the
    /// centred title's share is taken of (#692).
    @State private var paneWidth: CGFloat = 0

    package var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            // Zero-height wherever there is no toolbar above the deck, so a specimen of the deck
            // alone draws no title.
            TitlebarTitle(header: header, paneWidth: paneWidth)
                .frame(height: reach)
            SessionTabLine(header: header, handOff: handOff)
                .frame(height: ArgoLayout.deckTabSlotHeight)
        }
        .frame(height: ArgoLayout.deckCanopyHeight + reach)
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { paneWidth = $0 }
        .argoChromeBar()
        .ignoresSafeArea(.container, edges: .top)
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(
        header: SessionHeaderProjection.Header?,
        reach: CGFloat = 0,
        handOff: @escaping () async -> Void = {},
    ) {
        self.header = header
        self.reach = reach
        self.handOff = handOff
    }
}

package extension EnvironmentValues {
    /// How far the canopy reaches down over the deck, published by `SessionsDeck`. Zero everywhere
    /// else, so a zone rendered on its own draws with nothing over it.
    @Entry var argoDeckCanopy: CGFloat = 0
}

extension View {
    /// Starts this zone below the canopy and keeps it there. For the furniture that does not
    /// scroll — the seams, the minimap lane, the word on an empty feed.
    func argoUnderCanopy() -> some View {
        modifier(ArgoUnderCanopy())
    }

    /// Runs this scroll view's content BENEATH the canopy: it opens below the glass and passes
    /// under it when scrolled. A content margin and not padding, so what a `ScrollViewReader`
    /// scrolls to lands below the glass rather than behind it.
    func argoScrollsUnderCanopy() -> some View {
        modifier(ArgoScrollsUnderCanopy())
    }
}

/// The two insets spelled once, so a zone added to the deck later cannot quietly miss them.
private struct ArgoUnderCanopy: ViewModifier {
    @Environment(\.argoDeckCanopy) private var canopy

    func body(content: Content) -> some View {
        content.padding(.top, canopy)
    }
}

private struct ArgoScrollsUnderCanopy: ViewModifier {
    @Environment(\.argoDeckCanopy) private var canopy

    func body(content: Content) -> some View {
        content.contentMargins(.top, canopy, for: .scrollContent)
    }
}

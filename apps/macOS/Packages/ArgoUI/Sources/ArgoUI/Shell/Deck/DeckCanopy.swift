import SwiftUI

/// The deck's top zone — the Session's identity and the tab line under it — as ONE glass bar
/// floating over the reading, rather than two opaque slots stacked above it.
///
/// It carries no hairline of its own. The material is the boundary: rows arriving at the canopy
/// blur through it instead of stopping at a rule, which is the whole reason the zone floats.
struct DeckCanopy: View {
    /// Absent when nothing is selected. The bar still holds its height — every zone under it is
    /// inset by that height, and a canopy that collapsed would move all of them.
    let header: SessionHeaderProjection.Header?
    /// Hand this Session's work to a fresh one. Inert by default, so a specimen draws the button
    /// and spawns nothing.
    var handOff: () async -> Void = {}

    var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            SessionHeader(header: header, handOff: handOff)
                .frame(height: ArgoLayout.deckHeaderHeight)
            SessionTabLine(spend: header?.spend)
                .frame(height: ArgoLayout.deckTabSlotHeight)
        }
        .frame(height: ArgoLayout.deckCanopyHeight)
        // Square, because the bar meets the window on three sides: a radius here would open a
        // crescent of deck at each top corner (D40).
        .argoFloatingGlass(in: Rectangle())
    }
}

extension EnvironmentValues {
    /// How far the canopy reaches down over the deck, published by `SessionsDeck` and read by the
    /// three zones that run beneath it. An environment value rather than a parameter: it would
    /// otherwise be threaded through four layers to reach the feed's scroller, and every one of
    /// them would be carrying a fact about a view it does not draw.
    ///
    /// Zero everywhere else, so a specimen or a preview renders the zone with nothing over it.
    @Entry var argoDeckCanopy: CGFloat = 0
}

#Preview("Deck canopy — over a reading it does not stop") {
    SessionsDeck(
        feed: FeedProjection.longRows,
        header: SessionHeaderFixture.header(for: .managed),
    )
    .frame(width: 900, height: 620)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Deck canopy — as a reader who asked for no transparency sees it") {
    SessionsDeck(
        feed: FeedProjection.longRows,
        header: SessionHeaderFixture.header(for: .managed),
    )
    .argoWithoutTransparency()
    .frame(width: 900, height: 620)
    .argoDeckSurface()
    .argoAppearance()
}

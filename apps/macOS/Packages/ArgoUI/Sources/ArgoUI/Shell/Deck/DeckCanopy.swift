import SwiftUI

/// The deck's top zone — the Session's identity and the tab line under it — as ONE glass bar
/// floating over the reading (D10, as its 2026-08-12 amendment reads it).
///
/// It carries no hairline of its own: the material is the boundary.
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
    /// How far the canopy reaches down over the deck, published by `SessionsDeck`. Zero everywhere
    /// else, so a zone rendered on its own draws with nothing over it.
    @Entry var argoDeckCanopy: CGFloat = 0
}

extension View {
    /// Starts this zone below the canopy instead of behind it. Every zone in the deck takes either
    /// this or the feed's scroller inset — the feed is the only one whose content runs UNDER the
    /// glass, because it is the only one that scrolls.
    func argoUnderCanopy() -> some View {
        modifier(ArgoUnderCanopy())
    }
}

/// The inset spelled once, so a zone added to the deck later cannot quietly miss it.
private struct ArgoUnderCanopy: ViewModifier {
    @Environment(\.argoDeckCanopy) private var canopy

    func body(content: Content) -> some View {
        content.padding(.top, canopy)
    }
}

/// The bar over a reading long enough to run beneath it, and over nothing — an empty deck and a
/// deck with no Session on it are two different absences.
private struct DeckCanopyGallery: View {
    var isFlat = false

    var body: some View {
        VStack(spacing: ArgoSpacing.section) {
            SessionsDeck(
                feed: FeedProjection.longRows,
                header: SessionHeaderFixture.header(for: .managed),
                held: FeedProjection.longHeldRowID,
            )
            SessionsDeck(feed: [])
        }
        .argoWithoutTransparency(isFlat)
        .frame(width: 900, height: 800)
        .argoDeckSurface()
        .argoAppearance()
    }
}

#Preview("Deck canopy — over a reading, and over nothing") {
    DeckCanopyGallery()
}

#Preview("Deck canopy — as a reader who asked for no transparency sees it") {
    DeckCanopyGallery(isFlat: true)
}

import SwiftUI

/// The Sessions room's zone layout, stacked flush.
///
/// It paints no background: `InstrumentDeckShell` is the opaque plane, and a second fill here
/// would be a second surface where the contract allows one. The separators sit where the
/// approved study puts them and nowhere else — the header and its tabs read as one region, so
/// nothing is drawn between them.
struct SessionsDeck: View {
    /// The selected Session's reading. Projected above the deck rather than here — the deck is a
    /// layout, and a zone that looked a Session up would be the layout choosing what to draw.
    let feed: [FeedRow]

    var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            DeckSlot(zone: .header)
                .frame(height: ArgoLayout.deckHeaderHeight)
            DeckSlot(zone: .tabs)
                .frame(height: ArgoLayout.deckTabSlotHeight)
            DeckSeparator()
            DeckContentRow(feed: feed)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// The rail and the lane are fixed measures and run the whole height of the row; the feed column
/// takes everything left, because the deck is as wide as the window is and the feed is what it
/// exists for.
private struct DeckContentRow: View {
    let feed: [FeedRow]

    var body: some View {
        HStack(spacing: ArgoSpacing.flush) {
            DeckSlot(zone: .rail)
                .frame(width: ArgoLayout.agentsRailWidth)
            DeckSeparator()
            FeedColumn(feed: feed)
            DeckSeparator()
            DeckSlot(zone: .minimap)
                .frame(width: ArgoLayout.minimapLaneWidth)
        }
    }
}

/// The feed and the dock that steers it, bounded to their own column rather than run across the
/// deck (C4.1).
private struct FeedColumn: View {
    let feed: [FeedRow]

    var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            FeedView(rows: feed)
            DeckSeparator()
            DeckSlot(zone: .dock)
                .frame(height: ArgoLayout.deckDockHeight)
        }
    }
}

#Preview("Sessions deck — zones") {
    SessionsDeck(feed: FeedProjection.previewRows)
        .frame(width: 900, height: 620)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Sessions deck — a Session that has said nothing") {
    SessionsDeck(feed: [])
        .frame(width: 900, height: 620)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Sessions deck — narrowest deck the window allows") {
    SessionsDeck(feed: FeedProjection.previewRows)
        .frame(
            width: ArgoLayout.windowMinimumWidth - ArgoLayout.sidebarMinimumWidth,
            height: ArgoLayout.windowMinimumHeight,
        )
        .argoDeckSurface()
        .argoAppearance()
}

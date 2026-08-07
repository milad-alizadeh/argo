import SwiftUI

/// The Sessions room's zone layout: header, tabs, the rail | feed | lane row, and the Dock
/// seam, stacked flush.
///
/// It paints no background. `InstrumentDeckShell` is the opaque plane; this is the division of
/// it, and a second fill here would be a second surface where the contract allows one.
///
/// The hairlines sit exactly where the approved study puts them — under the tabs, between the
/// rail and the feed, along the lane, and above the Dock — and nowhere else. The header and its
/// tabs read as one region, so nothing is drawn between them.
struct SessionsDeck: View {
    var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            DeckSlot(zone: .header)
                .frame(height: ArgoLayout.deckHeaderHeight)
            DeckSlot(zone: .tabs)
                .frame(height: ArgoLayout.deckTabSlotHeight)
            DeckSeam()
            DeckContentRow()
            DeckSeam()
            DeckSlot(zone: .dock)
                .frame(height: ArgoLayout.dockSeamHeight)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// Rail | feed | lane. The rail and the lane are fixed measures; the feed takes everything
/// left, because the deck is as wide as the window is and the feed is what it exists for.
private struct DeckContentRow: View {
    var body: some View {
        HStack(spacing: ArgoSpacing.flush) {
            DeckSlot(zone: .rail)
                .frame(width: ArgoLayout.agentsRailWidth)
            DeckSeam()
            DeckSlot(zone: .feed)
            DeckSeam()
            DeckSlot(zone: .minimap, verticalMark: true)
                .frame(width: ArgoLayout.minimapLaneWidth)
        }
    }
}

#Preview("Sessions deck — zones") {
    SessionsDeck()
        .frame(width: 900, height: 620)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Sessions deck — narrowest deck the window allows") {
    SessionsDeck()
        .frame(
            width: ArgoLayout.windowMinimumWidth - ArgoLayout.sidebarMinimumWidth,
            height: ArgoLayout.windowMinimumHeight,
        )
        .argoDeckSurface()
        .argoAppearance()
}

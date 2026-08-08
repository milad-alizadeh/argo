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
    /// Which call's evidence the panel is showing, if any. Held by the deck because the panel is a
    /// zone of the deck: the feed cannot own a selection that resizes the row it sits in.
    @State var open: FeedRow.ID?

    var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            DeckSlot(zone: .header)
                .frame(height: ArgoLayout.deckHeaderHeight)
            DeckSlot(zone: .tabs)
                .frame(height: ArgoLayout.deckTabSlotHeight)
            DeckSeparator()
            DeckContentRow(feed: feed, open: $open)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// The minimap is a fixed measure and runs the whole height of the row. The rail is too — until
/// the panel opens, when it is the width the panel is made of.
private struct DeckContentRow: View {
    let feed: [FeedRow]
    @Binding var open: FeedRow.ID?

    var body: some View {
        HStack(spacing: ArgoSpacing.flush) {
            if openCall == nil {
                DeckSlot(zone: .rail)
                    .frame(width: ArgoLayout.agentsRailWidth)
                DeckSeparator()
            }
            FeedColumn(feed: feed, open: $open)
            if let call = openCall {
                DeckSeparator()
                EvidencePanel(call: call) { open = nil }
                    .frame(minWidth: ArgoLayout.evidencePanelMinimumWidth)
                    .transition(.identity)
            }
            DeckSeparator()
            DeckSlot(zone: .minimap)
                .frame(width: ArgoLayout.minimapLaneWidth)
        }
    }

    /// The open row, resolved against the CURRENT feed rather than remembered. A live transcript
    /// grows under the panel, and a call held by value here would go on showing what it produced
    /// after the row it belongs to had gone.
    private var openCall: FeedCall? {
        guard let open, case let .call(call) = feed.first(where: { $0.id == open })?.content else {
            return nil
        }
        return call
    }
}

/// The feed and the dock that steers it, bounded to their own column rather than run across the
/// deck (C4.1).
private struct FeedColumn: View {
    let feed: [FeedRow]
    @Binding var open: FeedRow.ID?

    var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            FeedView(rows: feed, open: $open)
            DeckSeparator()
            DeckSlot(zone: .dock)
                .frame(height: ArgoLayout.deckDockHeight)
        }
        // Never wider than the reading measure once the panel is up: the column has nothing to do
        // with the extra points, and the panel does.
        .frame(maxWidth: open == nil ? .infinity : ArgoFeedRow.measure + ArgoFeedRow.inset * 2)
    }
}

#Preview("Sessions deck — zones") {
    SessionsDeck(feed: FeedProjection.previewRows)
        .frame(width: 900, height: 620)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Sessions deck — a call's evidence open beside the feed") {
    SessionsDeck(feed: FeedProjection.previewRows, open: FeedProjection.previewFailedCallID)
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

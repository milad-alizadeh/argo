import SwiftUI

/// The Sessions room's zone layout, stacked flush.
///
/// It paints no background: `InstrumentDeckShell` is the opaque plane, and a second fill here would
/// be a second surface where the contract allows one. The separators sit where the approved study
/// puts them and nowhere else — the header and its tabs read as one region, so nothing is drawn
/// between them.
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

/// The zones across the deck, in the order they are read: the rail, the feed, the minimap pinned to
/// the feed it maps, and the evidence panel outboard of all of them.
///
/// The minimap's place is the load-bearing part. It is a map OF the feed, so nothing may come
/// between them — a panel opening in that gap pushed the map away from the column it belongs to and
/// left it reading as a second sidebar. The panel takes the far edge instead.
///
/// Two of the three seams move. The minimap's does not: it is a fixed measure, like Xcode's, and a
/// map wide enough to be a map is not a preference.
private struct DeckContentRow: View {
    let feed: [FeedRow]
    @Binding var open: FeedRow.ID?

    @State private var railWidth = ArgoLayout.agentsRailWidth
    /// What the reader dragged the panel to. `nil` until they do — the panel opens at its share of
    /// the deck, which depends on a width this view does not know until it is laid out.
    @State private var panelWidth: CGFloat?

    var body: some View {
        GeometryReader { proxy in
            HStack(spacing: ArgoSpacing.flush) {
                // The rail closes when the panel opens. The two are alternatives rather than
                // neighbours: a reader looking at what one call produced is not picking a Session,
                // and three columns beside a fourth leaves none of them a usable width.
                if openCall == nil {
                    DeckSlot(zone: .rail)
                        .frame(width: railWidth)
                    DeckSeam(
                        width: $railWidth,
                        limits: railLimits(in: proxy.size.width),
                        growsRightward: true,
                    )
                }
                FeedColumn(feed: feed, open: $open)
                DeckSeparator()
                DeckSlot(zone: .minimap)
                    .frame(width: ArgoLayout.minimapLaneWidth)
                panel(in: proxy.size.width)
            }
        }
    }

    @ViewBuilder private func panel(in deck: CGFloat) -> some View {
        if let call = openCall {
            DeckSeam(
                width: panelBinding(in: deck),
                limits: panelLimits(in: deck),
                growsRightward: false,
            )
            EvidencePanel(call: call) { open = nil }
                .frame(width: panelBinding(in: deck).wrappedValue)
                .transition(.identity)
        }
    }

    /// The panel's width, defaulting to its share of everything that is not the minimap — the rail-
    /// and-feed span it is taking the room from, measured the same whether the rail is up.
    private func panelBinding(in deck: CGFloat) -> Binding<CGFloat> {
        let limits = panelLimits(in: deck)
        let opening = (deck - ArgoLayout.minimapLaneWidth) * ArgoLayout.evidencePanelShare
        return Binding(
            get: { min(max(panelWidth ?? opening, limits.lowerBound), limits.upperBound) },
            set: { panelWidth = $0 },
        )
    }

    /// Both limits are read off the deck's own width, so a window narrow enough that the floors
    /// cannot all be met yields the least-bad arrangement rather than a negative one.
    private func panelLimits(in deck: CGFloat) -> ClosedRange<CGFloat> {
        let floor = ArgoLayout.evidencePanelMinimumWidth
        // The rail is shut while the panel is up, so the only floor to leave room for is the
        // feed's.
        let ceiling = deck - ArgoLayout.minimapLaneWidth - ArgoLayout.feedMinimumWidth
        return floor ... max(floor, ceiling)
    }

    private func railLimits(in deck: CGFloat) -> ClosedRange<CGFloat> {
        let taken = ArgoLayout.minimapLaneWidth + ArgoLayout.feedMinimumWidth
        let ceiling = min(ArgoLayout.railWidths.upperBound, deck - taken)
        let floor = ArgoLayout.railWidths.lowerBound
        return floor ... max(floor, ceiling)
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
        // Whatever the two seams leave it. The column used to be capped at its reading measure when
        // the panel opened, which is the panel deciding how wide the feed is — the seam decides
        // now,
        // and prose inside the column is held to the measure by the rows themselves.
        .frame(maxWidth: .infinity)
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

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
    /// Which picture is open full size. Held HERE and not one level down, because the lightbox
    /// covers the whole deck: a picture opened over the feed column alone would be a screenshot of
    /// a deck shown inside a third of one.
    @State var lit: FeedShot?

    var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            DeckSlot(zone: .header)
                .frame(height: ArgoLayout.deckHeaderHeight)
            DeckSlot(zone: .tabs)
                .frame(height: ArgoLayout.deckTabSlotHeight)
            DeckSeparator()
            DeckContentRow(feed: feed, selection: FeedRowSelection(open: $open, lit: $lit))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .argoLightbox($lit)
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
    let selection: FeedRowSelection

    @State private var railWidth = ArgoLayout.agentsRailWidth
    /// What the reader dragged the panel to. `nil` until they do — the panel opens at its share of
    /// the deck, which depends on a width this view does not know until it is laid out.
    @State private var panelWidth: CGFloat?

    var body: some View {
        GeometryReader { proxy in
            HStack(spacing: ArgoSpacing.flush) {
                if showsRail {
                    DeckSlot(zone: .rail)
                        .frame(width: railWidth)
                    DeckSeam(
                        width: $railWidth,
                        limits: railLimits(in: proxy.size.width),
                        growsRightward: true,
                    )
                }
                FeedColumn(feed: feed, selection: selection)
                if openEvidence == nil {
                    DeckSeparator()
                    DeckSlot(zone: .minimap)
                        .frame(width: ArgoLayout.minimapLaneWidth)
                }
                panel(in: proxy.size.width)
            }
            // Escape is the way out of anything that opened over what you were reading, and the
            // panel is no exception. It answers here rather than on the panel so a reader whose
            // focus is still in the feed — which is where the click that opened it came from —
            // does not have to reach into the panel first to be allowed to close it.
            .onExitCommand(perform: dismissTopmost)
        }
    }

    /// Whether the agents rail is on screen at all.
    ///
    /// Only while subagents are actually running. A column standing empty for the whole of every
    /// session that never delegated is a permanent claim that something belongs there — it took a
    /// third of the deck to say nothing, and the feed it took the room from is the thing being
    /// read. It appears when there is a subagent to show and goes when the last one lands.
    ///
    /// And never beside the panel. The two are alternatives rather than neighbours: a reader
    /// looking at what one call produced is not watching a fan-out, and three columns beside a
    /// fourth leaves none of them a usable width.
    private var showsRail: Bool {
        openEvidence == nil && FeedProjection.runningDelegations(in: feed) > 0
    }

    /// Whatever is over what the reader was reading, innermost first.
    ///
    /// Answering here as well as on the lightbox itself is deliberate: `onExitCommand` only fires
    /// for a view in the responder chain, and nothing focuses the lightbox on the way in.
    private func dismissTopmost() {
        if selection.lit != nil {
            selection.lit = nil
        } else {
            selection.open = nil
        }
    }

    @ViewBuilder private func panel(in deck: CGFloat) -> some View {
        if let evidence = openEvidence {
            DeckSeam(
                width: panelBinding(in: deck),
                limits: ArgoLayout.evidencePanelLimits(in: deck),
                growsRightward: false,
            )
            EvidencePanel(evidence: evidence) { selection.open = nil }
                .frame(width: panelBinding(in: deck).wrappedValue)
                .transition(.identity)
        }
    }

    /// The panel's width, defaulting to its share of the deck. Of the WHOLE deck, because the rail
    /// and the minimap are both shut while it is open — the feed is the only thing it shares with.
    private func panelBinding(in deck: CGFloat) -> Binding<CGFloat> {
        let limits = ArgoLayout.evidencePanelLimits(in: deck)
        let opening = deck * ArgoLayout.evidencePanelShare
        return Binding(
            get: { min(max(panelWidth ?? opening, limits.lowerBound), limits.upperBound) },
            set: { panelWidth = $0 },
        )
    }

    private func railLimits(in deck: CGFloat) -> ClosedRange<CGFloat> {
        let taken = ArgoLayout.minimapLaneWidth + ArgoLayout.feedMinimumWidth
        let ceiling = min(ArgoLayout.railWidths.upperBound, deck - taken)
        let floor = ArgoLayout.railWidths.lowerBound
        return floor ... max(floor, ceiling)
    }

    /// The open row's evidence, resolved against the CURRENT feed rather than remembered. A live
    /// transcript grows under the panel, and evidence held by value here would go on showing what
    /// a call produced after the row it belongs to had gone.
    private var openEvidence: FeedEvidence? {
        guard let open = selection.open,
              let content = feed.first(where: { $0.id == open })?.content
        else {
            return nil
        }
        return switch content {
        case let .call(call): call.opened
        case let .survey(survey): survey.opened
        // Prose opens nothing, and neither does a gallery — its shots open a lightbox instead, and
        // routing them through a panel would show a picture beside a smaller copy of itself. A row
        // that cannot be clicked into the panel cannot be the open one, so both arms are
        // unreachable — and they are cases rather than a `default` so a new row kind that CAN open
        // fails this build instead of silently resolving to a closed panel.
        case .prompt, .message, .thought, .gallery: nil
        }
    }
}

/// The feed and the dock that steers it, bounded to their own column rather than run across the
/// deck (C4.1).
private struct FeedColumn: View {
    let feed: [FeedRow]
    let selection: FeedRowSelection

    var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            FeedView(rows: feed, open: selection.$open, lit: selection.$lit)
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

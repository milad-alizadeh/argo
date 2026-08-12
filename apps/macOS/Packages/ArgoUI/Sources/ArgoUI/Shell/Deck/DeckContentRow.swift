import ArgoEngine
import SwiftUI

/// The zones across the deck, in the order they are read: the rail, the feed, the minimap pinned to
/// the feed it maps, and the evidence panel outboard of all of them.
///
/// Nothing may come between the minimap and the feed it maps — the panel takes the far edge. The
/// minimap's seam is fixed; the other two move.
struct DeckContentRow: View {
    let feed: [FeedRow]
    let showing: PlanShowing
    let selection: FeedRowSelection
    var held: FeedRow.ID?
    /// What is in the slot below the reading — see `DeckVessel`. The undriveable line is not drawn
    /// here: it replaces the reading's end rather than floating over it, so `SessionsDeck` owns it.
    var vessel = DeckVessel.none
    /// What that vessel's controls do.
    var intents = DeckIntents.inert
    let seams: DeckSeams
    /// One flag for both seams — only one of them can be dragged at a time.
    @State private var isResizing = false
    /// The reading's scroll authority, held here because two zones share it: the feed drives it and
    /// the minimap maps it.
    @State private var table = FeedTableHandle()

    var body: some View {
        GeometryReader { proxy in
            let zoning = zoning(in: proxy.size.width)

            HStack(spacing: ArgoSpacing.flush) {
                if zoning.showsRail {
                    AgentsRail(agents: zoning.agents)
                        .frame(width: seams.rail.wrappedValue)
                    DeckSeam(
                        width: seams.rail,
                        limits: zoning.railLimits,
                        growsRightward: true,
                        isDragging: { isResizing = $0 },
                    )
                }
                FeedColumn(
                    feed: feed,
                    showing: showing,
                    selection: selection,
                    held: held,
                    vessel: vessel,
                    intents: intents,
                    table: table,
                )
                if !zoning.isPanelOpen {
                    DeckSeparator()
                        .transition(.opacity)
                    MinimapLane(feed: table)
                        .frame(width: ArgoLayout.minimapLaneWidth)
                        .transition(.opacity)
                }
                panel(zoning)
            }
            // One transaction for the whole re-flow: three zones move on the one fact — the panel
            // arrives, the rail and the minimap leave — so animating only the panel slides it in
            // beside two columns that already blinked out. Scoped to the value rather than ambient
            // so a feed growing underneath is still laid out instantly.
            .argoAnimation(.reveal, value: zoning.isPanelOpen)
            // Answers here rather than on the panel: the click that opened it came from the feed,
            // so that is where focus still is.
            .onExitCommand(perform: dismissTopmost)
            .environment(\.deckIsResizing, isResizing)
        }
    }

    private func zoning(in deck: CGFloat) -> DeckZoning {
        DeckZoning(deck: deck, feed: feed, open: selection.open, seams: seams)
    }

    /// Dismisses whatever is over what the reader was reading, innermost first. Answered here as
    /// well as on the lightbox: `onExitCommand` only fires for a view in the responder chain, and
    /// nothing focuses the lightbox on the way in.
    private func dismissTopmost() {
        if selection.lit != nil {
            selection.darken(returningInto: feed)
        } else {
            selection.close()
        }
    }

    /// The panel and the edge that sizes it, stacked as ONE thing that arrives: `.move` travels a
    /// view by its OWN width, and the hairline seam carrying the transition alone would move about
    /// a point. Stacked, the pair travels the panel's width.
    @ViewBuilder private func panel(_ zoning: DeckZoning) -> some View {
        if let evidence = zoning.openEvidence {
            HStack(spacing: ArgoSpacing.flush) {
                DeckSeam(
                    width: zoning.panelWidth,
                    limits: zoning.panelLimits,
                    growsRightward: false,
                    isDragging: { isResizing = $0 },
                )
                EvidencePanel(
                    evidence: evidence,
                    current: selection.step,
                    dismiss: selection.close,
                )
                .frame(width: zoning.panelWidth.wrappedValue)
                .focusable()
                .focused(selection.focus, equals: .panel)
            }
            .transition(.move(edge: .trailing))
        }
    }
}

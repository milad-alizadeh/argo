import ArgoEngine
import SwiftUI

/// The zones across the deck, in the order they are read: the rail, the feed, the minimap pinned to
/// the feed it maps, and the evidence panel outboard of all of them.
///
/// Nothing may come between the minimap and the feed it maps — the panel takes the far edge. The
/// minimap's seam is fixed; the other two move.
///
/// Every zone here starts below the canopy except the feed, which runs under it. That includes the
/// seams: a hairline reaching the window's top edge behind the glass is the rule the canopy
/// replaced, drawn again.
struct DeckContentRow: View {
    // Unpacked from `DeckContent` and `DeckVesselControl`, where each of these is documented.
    var reading = FeedReading.unattached
    let feed: [FeedRow]
    let showing: PlanShowing
    let selection: FeedRowSelection
    var held: FeedRow.ID?
    var vessel = DeckVessel.none
    var intents = DeckIntents.inert
    let seams: DeckSeams
    /// The rail as a control — what the feed is scoped to, and whether the rail is collapsed.
    var rail = AgentsRailControl.inert
    /// One flag for both seams — only one of them can be dragged at a time.
    @State private var isResizing = false
    /// The reading's scroll authority, held here because two zones share it: the feed drives it and
    /// the minimap maps it.
    @State private var table: FeedTableHandle

    /// Seeds the handle with `held`, which has to be true before the first frame.
    init(
        content: DeckContent,
        slot: DeckVesselControl = .inert,
        seams: DeckSeams,
        rail: AgentsRailControl = .inert,
    ) {
        self.reading = content.reading
        self.feed = content.feed
        self.showing = content.showing
        self.selection = content.picked.selection
        self.held = content.picked.held
        self.vessel = slot.vessel
        self.intents = slot.intents
        self.seams = seams
        self.rail = rail
        _table = State(initialValue: FeedTableHandle(held: content.picked.held))
    }

    /// The deck's selection with the keyboard's way home wired onto the reading's table — the copy
    /// every surface here closes through. See `FeedRowSelection.homing(onto:)`.
    private var routed: FeedRowSelection {
        selection.homing(onto: table)
    }

    /// Who else is working, read off the SESSION's rows — never off `scoped`, which is what the
    /// rail may have scoped away.
    private var agents: [FeedAgent] {
        rail.readings.agents(in: feed)
    }

    /// The rows the reading zones actually draw: the Session's own, or the selected Subagent's.
    /// Every fallback, and why each one exists, is `FeedAgentReader.rows(under:of:otherwise:)`.
    private var scoped: [FeedRow] {
        rail.readings.reading(of: feed, under: rail.scope)
    }

    var body: some View {
        GeometryReader { proxy in
            // Bound ONCE for the pass, the way `CockpitView.detail` binds its vessel: a
            // `GeometryReader` body re-runs on every size change — every frame of a seam drag — and
            // three zones below asked these two questions three times each.
            let agents = agents
            let scoped = scoped
            let zoning = zoning(in: proxy.size.width, feed: scoped, agents: agents)

            HStack(spacing: ArgoSpacing.flush) {
                if zoning.showsRail {
                    AgentsRail(agents: zoning.agents, control: rail)
                        .frame(width: zoning.railWidth)
                    railEdge(zoning)
                }
                // NO `.id(rail.scope)`: destroying the column to re-key its state took the
                // table, the ten rulers and every measured height with it. What a scope switch
                // actually invalidates is named instead — `reading` carries the scope, and
                // everything keyed on a row position resets on it (`FeedReading`).
                FeedColumn(
                    reading: reading,
                    feed: scoped,
                    showing: showing,
                    selection: routed,
                    held: held,
                    vessel: vessel,
                    intents: intents,
                    table: table,
                )
                DeckSeparator()
                    .argoUnderCanopy()
                MinimapLane(feed: table)
                    .frame(width: zoning.laneWidth)
                    .argoUnderCanopy()
                panel(zoning)
            }
            // One transaction for the whole re-flow: two zones move on the one fact — the panel
            // arrives and the rail leaves — so animating only the panel slides it in beside a
            // column that already blinked out. Scoped to the value rather than ambient so a feed
            // growing underneath is still laid out instantly.
            .argoAnimation(.reveal, value: zoning.isPanelOpen)
            // Answers here rather than on the panel: the click that opened it came from the feed,
            // so that is where focus still is.
            .onExitCommand(perform: dismissTopmost)
            .environment(\.deckIsResizing, isResizing)
        }
    }

    private func zoning(in deck: CGFloat, feed: [FeedRow], agents: [FeedAgent]) -> DeckZoning {
        DeckZoning(
            deck: deck,
            feed: feed,
            agents: agents,
            open: selection.open,
            seams: seams,
            isRailCollapsed: rail.isCollapsed,
        )
    }

    /// The rail's own edge. A plain separator while it is collapsed, because the strip is a fixed
    /// column: a grab area there would offer to size something that has no size to give.
    @ViewBuilder private func railEdge(_ zoning: DeckZoning) -> some View {
        if rail.isCollapsed {
            DeckSeparator()
                .argoUnderCanopy()
        } else {
            DeckSeam(
                width: seams.rail,
                limits: zoning.railLimits,
                growsRightward: true,
                isDragging: { isResizing = $0 },
            )
            .argoUnderCanopy()
        }
    }

    /// Dismisses whatever is over what the reader was reading, innermost first. Answered here as
    /// well as on the lightbox: `onExitCommand` only fires for a view in the responder chain, and
    /// nothing focuses the lightbox on the way in.
    ///
    /// The SCOPE is the outermost rung, taken only once nothing is over the reading: a Subagent's
    /// feed is a place the reader navigated to, so Escape leaves it the way it leaves the other two
    /// — and that makes the rail's chip the second way back rather than the only one.
    private func dismissTopmost() {
        if routed.lit != nil {
            routed.darken(returningInto: scoped)
        } else if routed.open != nil {
            routed.close()
        } else {
            rail.scope = .session
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
                .argoUnderCanopy()
                EvidencePanel(
                    evidence: evidence,
                    current: routed.step,
                    dismiss: routed.close,
                )
                .frame(width: zoning.panelWidth.wrappedValue)
                .focusable()
                .focused(selection.focus, equals: .panel)
                // Focusable so the keyboard can reach it, never ringed: the panel covers its own
                // zone, so what has focus is evident without one — and the system effect draws on
                // a click too, which is a keyboard cursor shown to a pointer (#533).
                .focusEffectDisabled()
            }
            .transition(.move(edge: .trailing))
        }
    }
}

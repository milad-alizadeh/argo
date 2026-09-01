import ArgoEngine
import SwiftUI

/// The Sessions room's zone layout: the content row filling the deck, with the canopy floating over
/// its top edge. It paints no background — `InstrumentDeckShell` is the opaque plane, and a second
/// fill here would be a second surface where the contract allows one.
///
/// The canopy shares the stack's top edge with the row rather than sitting above it in a column —
/// the reading has to reach the deck's top edge to pass under the glass.
struct SessionsDeck: View {
    /// Which Session is being read, as an IDENTITY — nothing here draws it. Half of `FeedReading`;
    /// the rail's scope is the other half. `nil` in a preview and a specimen, where nothing
    /// switches.
    var session: CockpitPresentation.Session.ID?
    /// The selected Session's reading, projected above the deck.
    let feed: [FeedRow]
    /// What the top zone names. Absent when nothing is selected: the zone keeps its height and says
    /// nothing.
    var header: SessionHeaderProjection.Header?
    /// Hand the shown Session's work to a fresh one. Inert by default so a specimen draws the
    /// button without spawning anything.
    var handOff: () async -> Void = {}
    /// The selected Session's plan — standing state rather than a row, so it arrives beside the
    /// rows and not among them.
    var showing = PlanShowing()
    /// Which call's evidence the panel is showing, if any. NOT the feed's: the feed cannot own a
    /// selection that resizes the row it sits in. Held above this view since #875, because the
    /// toolbar's toggle reaches it and the toolbar is outside the deck — see `CockpitView`, which
    /// is also where the per-Session clearing `.id(session)` used to give for free now lives.
    var open: Binding<FeedRow.ID?> = .constant(nil)
    /// Which result inside the open row the panel is showing — see `FeedRowSelection.step`. Beside
    /// `open` and for its reason: the two are one selection.
    var step: Binding<Int?> = .constant(nil)
    /// Which picture is open full size. Held HERE because the lightbox covers the whole deck.
    @State var lit: FeedShot?
    /// Which row the reading opens held at — see `FeedView.held`. Where the reading STARTS; the
    /// scroll owns it from there.
    var held: FeedRow.ID?
    /// What is in the deck's one slot below the reading — see `DeckVessel`.
    var vessel = DeckVessel.none
    /// What that vessel's controls do. Inert by default, so a specimen draws them without
    /// reaching for a terminal.
    var intents = DeckIntents.inert
    /// Where the reader dragged the deck's seams — held above this view, never in it. See
    /// `DeckSeams`.
    var seams = DeckSeams.unheld
    /// Whether the rail is collapsed. Above this view for the same reason the seams are: it is a
    /// standing preference, not a fact about the Session on screen.
    var isRailCollapsed = Binding.constant(false)
    /// Each Subagent's own reading, for the rail's chips to be scoped onto. Empty until the engine
    /// reads them (#711). A specimen passes fixtures, so the scoped feed is a state somebody has
    /// looked at. See `FeedAgentReader`.
    var readings = FeedAgentReader.unread
    /// Which Agent's work the feed is reading. Held above this view since #875, beside `open`: the
    /// toolbar's toggle opens the newest evidence in the rows ON SCREEN, and which rows those are
    /// is this. A scope still names a delegation of THIS Session's and must not survive a switch —
    /// `CockpitView` clears it with the rest.
    var scope: Binding<FeedScope> = .constant(.session)
    /// Where the keyboard is across the whole reading — the feed, the panel and the lightbox in one
    /// space, so focus can come back out of the two that cover it. See `FeedFocus`.
    @FocusState private var focus: FeedFocus?

    /// What the zones below are showing, as one value — see `FeedReading`. This is what the deck's
    /// `.id(session)` used to say by destroying everything under it (ADR-0028 Rule 5).
    private var reading: FeedReading {
        FeedReading(session: session, scope: scope.wrappedValue)
    }

    var body: some View {
        // The canopy is declared FIRST and lifted by `zIndex`, not laid over the row as an overlay:
        // a stack is read in declaration order, so an overlay would put the Session's title after
        // the whole reading for VoiceOver and for the keyboard. `zIndex` moves only the paint.
        //
        // The zones climb past the safe area to the window's TOP EDGE, and the canopy inset grows
        // by the same amount, so nothing moves at rest but a scrolled reading runs behind the whole
        // bar — stopping at the safe area left the toolbar's stretch of glass with nothing under
        // it, a reading vanishing mid-bar. Measured before the zones discard it, hence the reader.
        GeometryReader { window in
            ZStack(alignment: .top) {
                DeckCanopy(header: header, reach: window.safeAreaInsets.top, handOff: handOff)
                    .zIndex(1)
                zones
                    .ignoresSafeArea(.container, edges: .top)
            }
            .environment(
                \.argoDeckCanopy,
                ArgoLayout.deckCanopyHeight + window.safeAreaInsets.top,
            )
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .argoLightbox(selection, in: feed)
        // A panel and a lightbox are opened on a ROW, and another reading — a Session switch or a
        // scope switch — replaces every row under them. Left open they would show one reading's
        // evidence over another's feed. `CockpitView.forgetEvidence()` clears the same two from
        // above on a Session switch, because the toolbar reaches them; the lightbox is only ever
        // this view's, so this is the one place that puts it out.
        .onChange(of: reading) { _, _ in
            open.wrappedValue = nil
            step.wrappedValue = nil
            lit = nil
        }
    }

    private var zones: some View {
        VStack(spacing: ArgoSpacing.flush) {
            DeckContentRow(
                reading: reading,
                feed: feed,
                showing: showing,
                selection: selection,
                held: held,
                vessel: vessel,
                intents: intents,
                seams: seams,
                rail: AgentsRailControl(
                    scope: scope,
                    isCollapsed: isRailCollapsed,
                    readings: readings,
                ),
            )
            // A ROW and not an overlay, unlike the vessel above: the feed runs under a composer and
            // stays readable through the glass, where this replaces the reading's end. It spans the
            // whole deck for the same reason — the rail and the panel cannot be driven either.
            if let unavailable = vessel.unavailable {
                ComposerUnavailable(reason: unavailable, spawn: intents.spawnBeside)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var selection: FeedRowSelection {
        FeedRowSelection(open: open, step: step, lit: $lit, focus: $focus)
    }
}

#Preview("Sessions deck — zones") {
    SessionsDeck(
        feed: FeedProjection.previewRows,
        header: SessionHeaderFixture.header(for: .managed),
        showing: PlanShowing(plan: PlanProjection.previewReading),
    )
    .frame(width: 900, height: 620)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Sessions deck — a call's evidence open beside the feed") {
    SessionsDeck(
        feed: FeedProjection.previewRows,
        open: .constant(FeedProjection.previewFailedCallID),
    )
    .frame(width: 900, height: 620)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Sessions deck — the plan's list open over the feed") {
    SessionsDeck(
        feed: FeedProjection.previewRows,
        showing: PlanShowing(plan: PlanFixture.working, isRevealed: true),
    )
    .frame(width: 900, height: 620)
    .argoDeckSurface()
    .argoAppearance()
}

// No plan on this one, and that is the point: a Session that never reported one shows no pill.
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

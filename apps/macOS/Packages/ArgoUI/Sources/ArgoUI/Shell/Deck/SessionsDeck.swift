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
    /// What the top zone names, projected above the deck for the same reason the feed is. Absent
    /// when nothing is selected: the zone keeps its height and says nothing.
    var header: SessionHeaderProjection.Header?
    /// Hand the shown Session's work to a fresh one — the header's one intent. Inert by default so
    /// a specimen draws the button without spawning anything.
    var handOff: () async -> Void = {}
    /// The selected Session's plan, projected above the deck for the same reason the feed is. It
    /// is standing state rather than a row, which is exactly why it arrives beside the rows and
    /// not among them.
    var showing = PlanShowing()
    /// Which call's evidence the panel is showing, if any. Held by the deck because the panel is a
    /// zone of the deck: the feed cannot own a selection that resizes the row it sits in.
    @State var open: FeedRow.ID?
    /// Which picture is open full size. Held HERE and not one level down, because the lightbox
    /// covers the whole deck: a picture opened over the feed column alone would be a screenshot of
    /// a deck shown inside a third of one.
    @State var lit: FeedShot?
    /// Which row the reading opens held at — see `FeedView.held`. Passed straight through rather
    /// than held as state: it is where the reading STARTS, and the scroll owns it from there.
    var held: FeedRow.ID?
    /// The shown Session's composer, projected above the deck for the reason the feed is — and
    /// absent for a Session Argo cannot drive, which draws nothing rather than a disabled field.
    var composer: SessionComposerProjection.Composer?
    /// One Turn to the shown Session. Inert by default so a specimen draws the vessel without
    /// reaching for a terminal.
    var send: (String) throws -> Void = { _ in }
    /// Where the reader dragged the deck's seams — held above this view, never in it. See
    /// `DeckSeams`.
    var seams = DeckSeams.unheld
    /// Where the keyboard is across the whole reading — the feed, the panel and the lightbox in one
    /// space, so focus can come back out of the two that cover it. See `FeedFocus`.
    @FocusState private var focus: FeedFocus?

    var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            SessionHeader(header: header, handOff: handOff)
                .frame(height: ArgoLayout.deckHeaderHeight)
            SessionTabLine(spend: header?.spend)
                .frame(height: ArgoLayout.deckTabSlotHeight)
            DeckSeparator()
            DeckContentRow(
                feed: feed,
                showing: showing,
                selection: selection,
                held: held,
                composer: composer,
                send: send,
                seams: seams,
            )
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .argoLightbox(selection, in: feed)
    }

    private var selection: FeedRowSelection {
        FeedRowSelection(open: $open, lit: $lit, focus: $focus)
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
    SessionsDeck(feed: FeedProjection.previewRows, open: FeedProjection.previewFailedCallID)
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

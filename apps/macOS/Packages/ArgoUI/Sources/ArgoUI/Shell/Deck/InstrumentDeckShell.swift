import SwiftUI

/// The opaque plane filling the detail side of the split view, flush to the window. It is the
/// ground the glass canopy is read against, so it is the one surface that must not borrow the
/// canopy's material (D10, D40).
struct InstrumentDeckShell: View {
    let room: CockpitRoom
    /// Which Session the deck is reading, as an IDENTITY rather than as content.
    ///
    /// Nothing below draws it. What it does is give the room's state a lifetime: the pane's state
    /// is per-Session — where the reader is in the reading, which prompts they unfolded, which
    /// call's evidence is open — and every one of those is meaningless against a different record.
    ///
    /// It has to be said out loud because the rows cannot say it. `FeedRow.ID` is a dense POSITION,
    /// so every Session's first row is `0` and its fortieth row is `40`; a pane keyed on the rows
    /// therefore reads one Session as a continuation of the last, keeps the offset it was left at,
    /// and opens the new reading in the middle of itself rather than on its newest line.
    var session: CockpitPresentation.Session.ID?
    /// The selected Session's reading, already projected. Rooms with no feed ignore it, which is
    /// the honest shape: the deck is one container and only one room has a feed in it today.
    var feed: [FeedRow] = []
    /// What the deck's top zone names, already projected — the Session as an identity rather than
    /// as the identifier above, which nothing draws.
    var header: SessionHeaderProjection.Header?
    /// Hand the shown Session's work to a fresh one — the header's one intent. Inert by default, so
    /// a specimen draws the button without spawning anything.
    var handOff: () async -> Void = {}
    /// The same Session's plan, which is standing state rather than a row and so travels beside
    /// the rows instead of among them.
    var showing = PlanShowing()
    /// Which call's evidence the deck opens with. A parameter so a specimen can render the panel
    /// open — the state is the deck's, and there is no other way to reach it without a click.
    var open: FeedRow.ID?
    /// Which picture the deck opens full size, for the same reason `open` is a parameter: the
    /// lightbox is reachable only by clicking a thumbnail, so without this nobody ever looks at it.
    var lit: FeedShot?
    /// Which row the reading opens held at — see `FeedView.held`. A third parameter of the same
    /// kind: the way back to the newest line is on screen only for a reader who scrolled away from
    /// it, and a screenshot cannot scroll.
    var held: FeedRow.ID?

    /// Where the reader dragged the deck's seams. Owned HERE, above the identity below, because a
    /// seam is a preference of the window and not a fact about the Session — keyed with the room it
    /// would snap back to its opening width every time the reader clicked a different Session.
    @State private var railWidth = ArgoLayout.agentsRailWidth
    @State private var panelWidth: CGFloat?

    var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .argoDeckSurface()
            .accessibilityElement(children: .contain)
            .accessibilityLabel("\(room.title) Instrument Deck")
    }

    /// The other rooms are bare ground rather than a borrowed layout: a placeholder deck in
    /// Work would claim a structure nobody has decided.
    @ViewBuilder private var content: some View {
        switch room {
        case .sessions:
            SessionsDeck(
                feed: feed,
                header: header,
                handOff: handOff,
                showing: showing,
                open: open,
                lit: lit,
                held: held,
                seams: DeckSeams(rail: $railWidth, panel: $panelWidth),
            )
            // The identity, spent. SwiftUI discards a view's whole state when its id changes, which
            // is the only thing that makes "the count does not survive a Session switch" — and "the
            // reading opens on its newest line" with it — true rather than assumed. On the DECK and
            // not on the feed alone: the panel and the lightbox are keyed to rows too, and an open
            // panel carried across reopens on whatever call now sits at that position.
            //
            // Everything discarded here has to be per-Session, which is why the seams above are
            // not: they are handed in from outside the identity rather than held under it.
            .id(session)
        case .work, .code:
            Color.clear
        }
    }
}

#Preview("Instrument Deck — Sessions") {
    InstrumentDeckShell(
        room: .sessions,
        feed: FeedProjection.previewRows,
        header: SessionHeaderFixture.header(for: .managed),
        showing: PlanShowing(plan: PlanProjection.previewReading),
    )
    .frame(width: 900, height: 620)
    .argoAppearance()
}

#Preview("Instrument Deck — a Session with nothing read yet") {
    InstrumentDeckShell(room: .sessions)
        .frame(width: 900, height: 620)
        .argoAppearance()
}

#Preview("Instrument Deck — a room with no zones yet") {
    InstrumentDeckShell(room: .work)
        .frame(width: 860, height: 620)
        .argoAppearance()
}

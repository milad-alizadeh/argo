import SwiftUI

/// The opaque plane filling the detail side of the split view, flush to the window. It is the
/// ground the glass canopy is read against, so it is the one surface that must not borrow the
/// canopy's material (D10, D40).
struct InstrumentDeckShell: View {
    let room: CockpitRoom
    /// The selected Session's reading, already projected. Rooms with no feed ignore it, which is
    /// the honest shape: the deck is one container and only one room has a feed in it today.
    var feed: [FeedRow] = []
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
            SessionsDeck(feed: feed, showing: showing, open: open, lit: lit, held: held)
        case .work, .code:
            Color.clear
        }
    }
}

#Preview("Instrument Deck — Sessions") {
    InstrumentDeckShell(
        room: .sessions,
        feed: FeedProjection.previewRows,
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

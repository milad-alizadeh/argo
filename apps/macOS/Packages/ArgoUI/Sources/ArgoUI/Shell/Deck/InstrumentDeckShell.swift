import ArgoDesign
import ArgoEngine
import SwiftUI

/// The opaque plane filling the detail side of the split view, flush to the window. It is the
/// ground the glass canopy is read against, so it is the one surface that must not borrow the
/// canopy's material (D10, D40).
package struct InstrumentDeckShell: View {
    let room: CockpitRoom
    /// Which Session the deck is reading, as an IDENTITY rather than as content — nothing below
    /// draws it. `FeedRow.ID` is a dense POSITION, so a pane keyed on the rows reads one Session as
    /// a continuation of the last and opens the new reading mid-scroll.
    ///
    /// Handed DOWN as a value, never spent as `.id(session)`. A view id destroys the whole subtree
    /// to reset four row-keyed facts, and the subtree is an `NSTableView`, ten measuring
    /// controllers, a minimap and every measured height — ADR-0028 Rule 5 forbids it. `FeedReading`
    /// is where the four facts are named instead.
    var session: CockpitPresentation.Session.ID?
    /// The selected Session's reading, already projected. Rooms with no feed ignore it.
    var feed: [FeedRow] = []
    /// What the deck's top zone names, already projected.
    var header: SessionHeaderProjection.Header?
    /// Hand the shown Session's work to a fresh one. Inert by default, so a specimen draws the
    /// button without spawning anything.
    var handOff: () async -> Void = {}
    /// The same Session's plan, which is standing state rather than a row.
    var showing = PlanShowing()
    /// Which call's evidence the panel is showing. A BINDING since #875: the toolbar's toggle
    /// writes it and the toolbar is above this view. A specimen holds it as state and passes that
    /// (`SessionsDeckSpecimen`): under `.constant` the panel renders open but no click opens one.
    var open: Binding<FeedRow.ID?> = .constant(nil)
    /// Which result inside that row the panel is showing. Beside `open` and for its reason.
    var step: Binding<Int?> = .constant(nil)
    /// Which picture the deck opens full size, for the same reason `open` is a parameter.
    var lit: FeedShot?
    /// Which row the reading opens held at — see `FeedView.held`. A parameter because a screenshot
    /// cannot scroll.
    var held: FeedRow.ID?
    /// What is in the deck's one slot below the reading, already resolved — see `DeckVessel`. A
    /// VALUE, so a specimen builds one from a fixture rather than from a live Hub.
    var vessel = DeckVessel.none
    /// What that vessel's controls do. Inert by default, so a specimen renders the vessel with
    /// nothing behind it.
    var intents = DeckIntents.inert
    /// Each Subagent's own reading, for the rail to scope the feed onto — see `FeedAgentReader`.
    var readings = FeedAgentReader.unread
    /// Which Agent the feed is scoped to. A binding for the reason `open` is one: the toolbar's
    /// evidence toggle opens the newest evidence in the rows ON SCREEN, and this says which those
    /// are. Seeded rather than clicked, the way `open` above is.
    var scope: Binding<FeedScope> = .constant(.session)
    /// The Tickets room, already assembled — one value rather than the projection and its two
    /// selections apart, so the sidebar and this deck cannot be handed different ones. `nil` in
    /// every other room, and the case below draws nothing for it.
    var tickets: TicketsRoom?

    /// Where the reader dragged the deck's seams. Owned HERE, above the identity below — keyed with
    /// the room it would snap back to its opening width on every Session switch.
    @State private var railWidth = ArgoAgentsRail.width
    @State private var panelWidth: CGFloat?
    /// Whether the rail is collapsed. Beside the seam widths and for their reason: a reader who
    /// collapsed it meant the rail, not this one Session's rail. Seedable for the same reason
    /// `scope` is a parameter.
    @State var isRailCollapsed = false

    package var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .argoDeckSurface()
            .accessibilityElement(children: .contain)
            .accessibilityLabel("\(room.title) Instrument Deck")
    }

    /// Code is bare ground on purpose: a placeholder deck there would claim a structure nobody has
    /// decided. Work is no longer one of them (#812).
    @ViewBuilder private var content: some View {
        switch room {
        case .sessions:
            SessionsDeck(
                session: session,
                feed: feed,
                header: header,
                handOff: handOff,
                showing: showing,
                open: open,
                step: step,
                lit: lit,
                held: held,
                vessel: vessel,
                intents: intents,
                seams: DeckSeams(rail: $railWidth, panel: $panelWidth),
                isRailCollapsed: $isRailCollapsed,
                readings: readings,
                scope: scope,
            )
        case .tickets:
            tickets?.deck
        case .code:
            Color.clear
        }
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(
        room: CockpitRoom,
        session: CockpitPresentation.Session.ID? = nil,
        feed: [FeedRow] = [],
        header: SessionHeaderProjection.Header? = nil,
        handOff: @escaping () async -> Void = {},
        showing: PlanShowing = PlanShowing(),
        open: Binding<FeedRow.ID?> = .constant(nil),
        step: Binding<Int?> = .constant(nil),
        lit: FeedShot? = nil,
        held: FeedRow.ID? = nil,
        vessel: DeckVessel = DeckVessel.none,
        intents: DeckIntents = DeckIntents.inert,
        readings: FeedAgentReader = FeedAgentReader.unread,
        scope: Binding<FeedScope> = .constant(.session),
        tickets: TicketsRoom? = nil,
        isRailCollapsed: Bool = false,
    ) {
        self.room = room
        self.session = session
        self.feed = feed
        self.header = header
        self.handOff = handOff
        self.showing = showing
        self.open = open
        self.step = step
        self.lit = lit
        self.held = held
        self.vessel = vessel
        self.intents = intents
        self.readings = readings
        self.scope = scope
        self.tickets = tickets
        _isRailCollapsed = State(wrappedValue: isRailCollapsed)
    }
}

#Preview("Instrument Deck — a Session with nothing read yet") {
    InstrumentDeckShell(room: .sessions)
        .frame(width: 900, height: 620)
        .argoAppearance()
}

#Preview("Instrument Deck — a room with no zones yet") {
    InstrumentDeckShell(room: .code)
        .frame(width: 860, height: 620)
        .argoAppearance()
}

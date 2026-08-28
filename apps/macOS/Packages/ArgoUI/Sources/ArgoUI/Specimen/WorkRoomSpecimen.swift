import ArgoEngine
import SwiftUI

/// The Work room in the shipping shell — the titlebar, the sidebar at its own ideal, and the deck's
/// two panes. This is the state `docs/designs/work-room/rest.png` is shot from.
///
/// The shell reads its room from three inputs now, not one fixture (#820): the listing, the Binding
/// behind the foot, and the roster the claims come off. All three are handed in here, so this draws
/// the room rather than the unbound page a Mac with nothing connected would.
///
/// Its dots are all `absent`, and `rest.png`'s are not. That is the shell being honest: nothing
/// reads a code host yet (#258), so the shipping room has no Delivery to mark. The dot's five
/// states are shot from `deliveryDots` and from the `WorkPanesSpecimen` renders, which take a
/// reading directly.
struct WorkRoomSpecimen: View {
    @State private var navigation = CockpitNavigationModel.pointedAtWork

    var body: some View {
        CockpitView(
            presentation: .workingTheBacklog,
            actions: .inert,
            health: .previewBound,
            tickets: WorkFixture.items,
            // The Binding the foot above it names, addressed — without it the row's two link verbs
            // render disabled, which is a different state from the one this shot is of (#872).
            ticketAddress: WorkFixture.address,
        )
        .environment(navigation)
    }
}

/// The room's two halves side by side, WITHOUT the shell — the harness for the states the shipping
/// shell cannot be driven into, since its Work room is fed from one fixture.
///
/// The titlebar is what it gives up, which is chrome the room does not decide.
struct WorkPanesSpecimen: View {
    private let reading: WorkReading

    @State private var cockpitRoom = CockpitRoom.work
    /// Seeded from the reading, so a specimen opens with the list's selection on the ticket the
    /// pane beside it is drawing — the two are one act in the app and must not part in a render.
    @State private var ticket: Int?
    /// Seeded from `opening` rather than parameterised, so the room still switches views when a
    /// person drives it — a specimen names a starting state, it does not freeze one.
    @State private var view: WorkView
    /// Seeded the same way, and the reason a folded parent can be SHOT: everything opens open, so
    /// `collapsed.png` is a state nobody could reach without clicking (#814).
    @State private var shut: Set<Int>
    /// The pane opens where it ships, so a render is shot at the width the reader first meets.
    @State private var backlogWidth = ArgoBacklogList.width
    /// What the search field is holding. Seeded for the same reason the fold is: the harness
    /// cannot type, and every state #873 has to show is past a typed query.
    @State private var query: String

    /// What a specimen seeds, as one value — a struct because the parameter cap is three.
    struct Seed {
        var opening = WorkView.allOpen
        var folded: Set<Int> = []
        var query = ""
    }

    init(reading: WorkReading, seed: Seed = Seed()) {
        self.reading = reading
        _view = State(initialValue: seed.opening)
        _shut = State(initialValue: seed.folded)
        _query = State(initialValue: seed.query)
        _ticket = State(initialValue: reading.showing)
    }

    var body: some View {
        let work = WorkRoom(
            room: WorkRoomProjection.room(from: reading, in: view, matching: query),
            cockpitRoom: $cockpitRoom,
            ticket: $ticket,
            view: $view,
            backlogWidth: $backlogWidth,
            shut: $shut,
        )

        HStack(spacing: ArgoSpacing.flush) {
            // Absent, not empty: with nothing bound the room hides WHOLE, and the shell hides its
            // half of the split view for the same reason (`CockpitView.roomHidesSidebar`).
            if work.room.vacancy != .unbound {
                work.sidebar
                    .frame(width: ArgoLayout.sidebarMinimumWidth)
                DeckSeparator()
            }
            work.deck
        }
        .argoDeckSurface()
    }
}

/// The ticket detail on its own, at the width the deck leaves it. The harness for the two states
/// `deep.png` and `edgeless.png` are shot from: the shipping shell opens on one fixture ticket, so
/// a parent with nine children and a provider with no edges cannot be reached by clicking.
struct TicketDetailSpecimen: View {
    private let reading: WorkReading

    @State private var ticket: Int?

    init(reading: WorkReading) {
        self.reading = reading
        _ticket = State(initialValue: reading.showing)
    }

    var body: some View {
        TicketDetail(
            ticket: WorkRoomProjection.room(from: reading.opened(at: ticket)).ticket,
            open: { ticket = $0 },
        )
        .frame(width: ArgoTicketDetail.idealWidth)
        .argoDeckSurface()
    }
}

/// Every reading of a Delivery's checks, and the chip with no page to open — the chip's whole
/// union, on the one surface that reads it.
struct DeliveryChipsSpecimen: View {
    var body: some View {
        VStack(alignment: .leading, spacing: ArgoTicketDetail.chipGap) {
            ForEach(WorkFixture.everyChip) { DeliveryChip(delivery: $0) }
        }
        .padding(ArgoSpacing.region)
        .frame(width: ArgoTicketDetail.idealWidth, alignment: .leading)
        .argoDeckSurface()
    }
}

/// The five states of the room's one Delivery signal, side by side — a discrete union told once,
/// which is the whole of what the backlog spends on a Delivery.
struct DeliveryDotsSpecimen: View {
    var body: some View {
        HStack(spacing: ArgoSpacing.section) {
            ForEach(DeliveryReading.allCases, id: \.self) { DeliveryDot(reading: $0) }
        }
        .padding(ArgoSpacing.region)
        .argoDeckSurface()
    }
}

extension CockpitNavigationModel {
    /// A window opened straight into the Work room, on the ticket the design's renders open on. The
    /// harness cannot click a room tab, so the state is built rather than driven.
    static var pointedAtWork: CockpitNavigationModel {
        let navigation = CockpitNavigationModel()
        navigation.room = .work
        navigation.ticket = 272
        return navigation
    }
}

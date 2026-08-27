import SwiftUI

/// The Work room in the shipping shell — the titlebar, the sidebar at its own ideal, and the deck's
/// two panes. This is the state `docs/designs/work-room/rest.png` is shot from.
struct WorkRoomSpecimen: View {
    @State private var navigation = CockpitNavigationModel.pointedAtWork

    var body: some View {
        CockpitView(presentation: .preview, actions: .inert)
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
    @State private var ticket: Int?
    /// Seeded from `opening` rather than parameterised, so the room still switches views when a
    /// person drives it — a specimen names a starting state, it does not freeze one.
    @State private var view: WorkView

    init(reading: WorkReading, opening: WorkView = .allOpen) {
        self.reading = reading
        _view = State(initialValue: opening)
    }

    var body: some View {
        let work = WorkRoom(
            room: WorkRoomProjection.room(from: reading, in: view),
            cockpitRoom: $cockpitRoom,
            ticket: $ticket,
            view: $view,
        )

        HStack(spacing: ArgoSpacing.flush) {
            work.sidebar
                .frame(width: ArgoLayout.sidebarMinimumWidth)
            DeckSeparator()
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
            selection: $ticket,
        )
        .frame(width: ArgoTicketDetail.idealWidth)
        .argoDeckSurface()
    }
}

/// Every reading of a Delivery's checks, side by side — a discrete union told once, on the chip
/// that is the only surface reading it.
struct DeliveryChipsSpecimen: View {
    var body: some View {
        VStack(alignment: .leading, spacing: ArgoTicketDetail.chipGap) {
            ForEach(WorkFixture.everyChecksReading) { DeliveryChip(delivery: $0) }
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

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
    let reading: WorkReading

    @State private var cockpitRoom = CockpitRoom.work
    @State private var ticket: Int?

    var body: some View {
        let room = WorkRoomProjection.room(from: reading)
        let work = WorkRoom(room: room, cockpitRoom: $cockpitRoom, ticket: $ticket)

        HStack(spacing: ArgoSpacing.flush) {
            work.sidebar
                .frame(width: ArgoLayout.sidebarMinimumWidth)
            DeckSeparator()
            work.deck
        }
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

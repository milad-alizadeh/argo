import SwiftUI

/// The Tickets room's sidebar: the room strip, the backlog's views, and the bound provider at the
/// foot. Views and NOT tickets — a view's name is written rather than inherited from a tracker, so
/// it fits a 280pt rail where nine of twelve real ticket titles truncated
/// (`cockpit-work-room.md`).
struct TicketsSidebar: View {
    @Environment(\.argo) private var argo

    let room: TicketsRoomProjection.Room
    /// Which room the strip is on. A binding, because the strip switches the whole window and this
    /// sidebar is only the pane it starts in.
    @Binding var cockpitRoom: CockpitRoom
    /// Which view is open. A binding and not this pane's own state: it decides which rows the DECK
    /// draws, so the room is derived from it before either half is built.
    @Binding var view: TicketsView
    /// What the hero performs (#898).
    var intents = NextUpIntents.inert

    var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            // Above the `List` and not a row inside it, so the strip lands on the same vertical as
            // the Sessions room's — a picker that scrolls in one room and not the other reads as
            // two controls (#816).
            RoomStrip(selection: $cockpitRoom)
            List(selection: $view) {
                backlogGroup
                hero
            }
            .listStyle(.sidebar)
            if let provider = room.provider {
                ProviderFoot(provider: provider)
            }
        }
    }

    private var backlogGroup: some View {
        Section {
            ForEach(room.views) { reading in
                ViewRow(
                    symbol: reading.id.symbol,
                    name: reading.id.name,
                    count: reading.count,
                    unplaced: reading.unplaced,
                )
                .argoSelectedRowGround(isSelected: reading.id == view)
                .tag(reading.id)
            }
        } header: {
            GroupLabel("Backlog")
        }
    }

    /// The hero, below the views and inside the same scroll. UNTAGGED: it is a card sitting on the
    /// rail rather than a fifth view, and a tag would let the arrow keys land on it and filter the
    /// deck to nothing.
    @ViewBuilder private var hero: some View {
        if let nextUp = room.nextUp {
            VStack(spacing: ArgoSpacing.flush) {
                ArgoRule(ink: argo.color.edge.hairline)
                NextUpCard(nextUp: nextUp, intents: intents)
            }
            .previewSafeListRow()
            .listRowInsets(EdgeInsets())
        }
    }
}

#Preview("Tickets sidebar") {
    @Previewable @State var room = CockpitRoom.tickets
    @Previewable @State var view = TicketsView.allOpen

    TicketsSidebar(room: TicketsFixture.room, cockpitRoom: $room, view: $view)
        .frame(width: ArgoLayout.sidebarMinimumWidth, height: 520)
        .argoAppearance()
}

#Preview("Tickets sidebar — nothing bound") {
    @Previewable @State var room = CockpitRoom.tickets
    @Previewable @State var view = TicketsView.allOpen

    TicketsSidebar(
        room: TicketsRoomProjection.room(from: TicketsFixture.unbound),
        cockpitRoom: $room,
        view: $view,
    )
    .frame(width: ArgoLayout.sidebarMinimumWidth, height: 520)
    .argoAppearance()
}

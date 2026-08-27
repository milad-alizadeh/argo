import SwiftUI

/// The Work room's sidebar: the room strip, two groups of views, and the bound provider at the
/// foot. Views and NOT tickets — a view's name is written rather than inherited from a tracker, so
/// it fits a 280pt rail where nine of twelve real ticket titles truncated
/// (`cockpit-work-room.md`).
struct WorkSidebar: View {
    let room: WorkRoomProjection.Room
    /// Which room the strip is on. A binding, because the strip switches the whole window and this
    /// sidebar is only the pane it starts in.
    @Binding var cockpitRoom: CockpitRoom

    /// Which view is open. Held here because it is this pane's own interaction state: nothing
    /// outside the sidebar opens a view, and it is not a fact the deck reads.
    @State private var selection = WorkView.allOpen

    var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            List(selection: $selection) {
                RoomStrip(selection: $cockpitRoom)
                    .previewSafeListRow()
                backlogGroup
                chartsGroup
            }
            .listStyle(.sidebar)
            if let provider = room.provider {
                ProviderFoot(provider: provider)
            }
        }
    }

    private var backlogGroup: some View {
        Section {
            ForEach(room.views) { view in
                ViewRow(symbol: view.id.symbol, name: view.id.name, count: view.count)
                    .tag(view.id)
            }
        } header: {
            GroupLabel("Backlog")
        }
    }

    /// One row per PRD-shaped parent — the entry point to its Route. Absent rather than empty: a
    /// group heading over nothing says a chart is missing.
    @ViewBuilder private var chartsGroup: some View {
        if !room.charts.isEmpty {
            Section {
                ForEach(room.charts) { chart in
                    ViewRow(symbol: ArgoSymbol.workRoom, name: chart.name, count: chart.count)
                }
            } header: {
                GroupLabel("Charts")
            }
        }
    }
}

#Preview("Work sidebar") {
    @Previewable @State var room = CockpitRoom.work

    WorkSidebar(room: WorkFixture.room, cockpitRoom: $room)
        .frame(width: ArgoLayout.sidebarMinimumWidth, height: 520)
        .argoAppearance()
}

#Preview("Work sidebar — nothing bound") {
    @Previewable @State var room = CockpitRoom.work

    WorkSidebar(
        room: WorkRoomProjection.room(from: WorkFixture.unbound),
        cockpitRoom: $room,
    )
    .frame(width: ArgoLayout.sidebarMinimumWidth, height: 520)
    .argoAppearance()
}

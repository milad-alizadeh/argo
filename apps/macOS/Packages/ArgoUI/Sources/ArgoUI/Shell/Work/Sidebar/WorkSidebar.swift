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
    /// Which view is open. A binding and not this pane's own state: it decides which rows the DECK
    /// draws, so the room is derived from it before either half is built.
    @Binding var view: WorkView

    var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            List(selection: $view) {
                RoomStrip(selection: $cockpitRoom)
                    .previewSafeListRow()
                backlogGroup
                chartsGroup
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
                ViewRow(symbol: reading.id.symbol, name: reading.id.name, count: reading.count)
                    .tag(reading.id)
            }
        } header: {
            GroupLabel("Backlog")
        }
    }

    /// The hero, below the views and inside the same scroll. UNTAGGED, like a chart row: it is a
    /// card sitting on the rail rather than a fifth view, and a tag would let the arrow keys land
    /// on it and filter the deck to nothing.
    @ViewBuilder private var hero: some View {
        if let nextUp = room.nextUp {
            NextUpCard(nextUp: nextUp)
                .previewSafeListRow()
                .listRowInsets(EdgeInsets())
        }
    }

    /// One row per PRD-shaped parent — the entry point to its Route. Absent rather than empty: a
    /// group heading over nothing says a chart is missing.
    ///
    /// Deliberately UNTAGGED: a chart opens the Route (#334), which is not built, and the list's
    /// selection is a `WorkView`. A tag here would make a row look selectable and then filter the
    /// backlog to something nobody asked for.
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
    @Previewable @State var view = WorkView.allOpen

    WorkSidebar(room: WorkFixture.room, cockpitRoom: $room, view: $view)
        .frame(width: ArgoLayout.sidebarMinimumWidth, height: 520)
        .argoAppearance()
}

#Preview("Work sidebar — nothing bound") {
    @Previewable @State var room = CockpitRoom.work
    @Previewable @State var view = WorkView.allOpen

    WorkSidebar(
        room: WorkRoomProjection.room(from: WorkFixture.unbound),
        cockpitRoom: $room,
        view: $view,
    )
    .frame(width: ArgoLayout.sidebarMinimumWidth, height: 520)
    .argoAppearance()
}

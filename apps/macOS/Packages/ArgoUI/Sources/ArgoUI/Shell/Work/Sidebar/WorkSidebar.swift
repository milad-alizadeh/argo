import SwiftUI

/// The Work room's sidebar: the room strip, two groups of views, and the bound provider at the
/// foot. Views and NOT tickets — a view's name is written rather than inherited from a tracker, so
/// it fits a 280pt rail where nine of twelve real ticket titles truncated
/// (`cockpit-work-room.md`).
struct WorkSidebar: View {
    @Environment(\.argo) private var argo

    let room: WorkRoomProjection.Room
    /// Which room the strip is on. A binding, because the strip switches the whole window and this
    /// sidebar is only the pane it starts in.
    @Binding var cockpitRoom: CockpitRoom
    /// Which view is open. A binding and not this pane's own state: it decides which rows the DECK
    /// draws, so the room is derived from it before either half is built.
    @Binding var view: WorkView
    /// Which chart the deck is scoped to, and `nil` on a view (#335).
    @Binding var chart: Int?

    var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            List(selection: selection) {
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

    /// The rail's one selection, derived from the two facts held above it rather than stored — a
    /// `List` selects one row, so a second stored selection could disagree with the pane beside it.
    private var selection: Binding<WorkSelection> {
        Binding(
            get: { WorkSelection(view: view, chart: chart) },
            set: { choice in
                switch choice {
                case let .view(next):
                    view = next
                    chart = nil
                case let .chart(parent):
                    chart = parent
                }
            },
        )
    }

    private var backlogGroup: some View {
        Section {
            ForEach(room.views) { reading in
                ViewRow(symbol: reading.id.symbol, name: reading.id.name, count: reading.count)
                    .tag(WorkSelection.view(reading.id))
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
            VStack(spacing: ArgoSpacing.flush) {
                ArgoRule(ink: argo.color.edge.hairline)
                NextUpCard(nextUp: nextUp)
            }
            .previewSafeListRow()
            .listRowInsets(EdgeInsets())
        }
    }

    /// One row per PRD-shaped parent — the entry point to its Route. Absent rather than empty: a
    /// group heading over nothing says a chart is missing.
    ///
    /// TAGGED since #335, which is what made the row mean something: selecting it scopes the deck
    /// to that parent and offers `Present as: Tree | Map`. It stood untagged through #814 because
    /// the list's selection was a `WorkView` and the Route was not built, so a row that looked
    /// selectable would have filtered the backlog to something nobody asked for.
    @ViewBuilder private var chartsGroup: some View {
        if !room.charts.isEmpty {
            Section {
                ForEach(room.charts) { chart in
                    ViewRow(symbol: ArgoSymbol.workRoom, name: chart.name, count: chart.count)
                        .tag(WorkSelection.chart(chart.id))
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
    @Previewable @State var chart: Int?

    WorkSidebar(room: WorkFixture.room, cockpitRoom: $room, view: $view, chart: $chart)
        .frame(width: ArgoLayout.sidebarMinimumWidth, height: 520)
        .argoAppearance()
}

#Preview("Work sidebar — nothing bound") {
    @Previewable @State var room = CockpitRoom.work
    @Previewable @State var view = WorkView.allOpen
    @Previewable @State var chart: Int?

    WorkSidebar(
        room: WorkRoomProjection.room(from: WorkFixture.unbound),
        cockpitRoom: $room,
        view: $view,
        chart: $chart,
    )
    .frame(width: ArgoLayout.sidebarMinimumWidth, height: 520)
    .argoAppearance()
}

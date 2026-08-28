import SwiftUI

/// The Work room, as the PAIR of views the shell's split view slots take.
///
/// Not one `View`: `NavigationSplitView` owns its two slots, so a room fills them rather than
/// replacing them — which is what `cockpit-work-room.md` means by "it does not own a split of its
/// own". Both halves read the same `Room` value, so the sidebar's counts and the deck's rows can
/// never be two different answers.
struct WorkRoom {
    let room: WorkRoomProjection.Room
    /// Which room the strip in the sidebar's head is on — the whole window's, not this room's.
    @Binding var cockpitRoom: CockpitRoom
    /// Which ticket the deck is open on. Held above the room, because the ticket outlives the pane.
    @Binding var ticket: Int?
    /// Which view is open. Above the room too, and for a sharper reason: `room.backlog` is already
    /// filtered to it, so the selection has to be settled before the room is derived.
    @Binding var view: WorkView
    /// Which chart the deck is scoped to, and `nil` on a view (#335). Above the room for the same
    /// reason the view is: it decides which rows the room is derived over.
    @Binding var chart: Int?
    /// Which parents the reader has switched to `Map`. A SET and not one value, because the toggle
    /// is map-scoped: mapping one parent leaves every other on whatever it had. Empty until
    /// somebody switches something — a chart opens as its tree, which is the presentation that
    /// works whether or not its edges were served.
    @Binding var mapped: Set<Int>
    /// Which parents the reader has folded. Above the room for the same reason the ticket is: a
    /// fold outlives the pane. **Everything opens open**, so it is empty until somebody folds
    /// something — a tree that opens shut hides what it was added for (#814).
    @Binding var shut: Set<Int>
    /// What the unbound page's `Connect a provider…` does. Inert by default, so a preview and a
    /// specimen draw the button without opening a panel behind the render.
    var connect: @MainActor () -> Void = {}

    var sidebar: some View {
        WorkSidebar(room: room, cockpitRoom: $cockpitRoom, view: $view, chart: $chart)
    }

    /// The room's controls, in the window's one toolbar row. A function and not a property, because
    /// the two things the row HOLDS are the window's rather than the room's — see `WorkToolbar` for
    /// why the row settles its columns by claiming the backlog's width.
    ///
    /// A chart's deck carries its own head, so the row EMPTIES for it (`cockpit-work-room.md`): a
    /// backlog heading and a ticket count over a progress axis would be naming a pane that is not
    /// on screen. Decided here rather than inside the projection, which is handed the room and the
    /// view and would need a third reading to know what replaced them.
    func toolbar(held: WorkToolbar.Held) -> WorkToolbar {
        WorkToolbar(
            reading: room.chart == nil
                ? WorkToolbarProjection.reading(of: room, in: view, showing: ticket)
                : .none,
            held: held,
        )
    }

    /// The two panes, a CHART's own deck in place of both, or one of the room's two vacancies —
    /// never more than one.
    @ViewBuilder var deck: some View {
        if let vacancy = room.vacancy {
            WorkRoomVacancy(vacancy: vacancy, project: room.project, connect: connect)
        } else if let chart = room.chart {
            ChartDeck(
                chart: chart,
                presentation: presentation(of: chart.parent),
                tree: ScopedTree(rows: room.backlog, selection: $ticket, shut: $shut),
            )
        } else {
            HStack(spacing: ArgoSpacing.flush) {
                BacklogList(rows: room.backlog, selection: $ticket, shut: $shut)
                DeckSeparator()
                TicketDetail(ticket: room.ticket) { ticket = $0 }
            }
        }
    }

    /// One parent's presentation, off the set of mapped parents. Derived rather than stored, so the
    /// map-scoped rule is arithmetic instead of something every caller has to remember.
    private func presentation(of parent: Int) -> Binding<WorkPresentation> {
        Binding(
            get: { mapped.contains(parent) ? .map : .tree },
            set: { choice in
                if choice == .map {
                    mapped.insert(parent)
                } else {
                    mapped.remove(parent)
                }
            },
        )
    }
}

#Preview("Work room — the deck's two panes") {
    @Previewable @State var ticket: Int? = 272
    @Previewable @State var cockpitRoom = CockpitRoom.work
    @Previewable @State var view = WorkView.allOpen
    @Previewable @State var chart: Int?
    @Previewable @State var mapped: Set<Int> = []
    @Previewable @State var shut: Set<Int> = []

    WorkRoom(
        room: WorkFixture.room, cockpitRoom: $cockpitRoom, ticket: $ticket, view: $view,
        chart: $chart, mapped: $mapped, shut: $shut,
    )
    .deck
    .frame(width: ArgoBacklogList.width + ArgoTicketDetail.idealWidth, height: 620)
    .argoDeckSurface()
    .argoAppearance()
}

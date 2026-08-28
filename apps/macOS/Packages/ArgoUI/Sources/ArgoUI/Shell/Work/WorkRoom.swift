import ArgoEngine
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
    /// Which parents the reader has folded. Above the room for the same reason the ticket is: a
    /// fold outlives the pane. **Everything opens open**, so it is empty until somebody folds
    /// something — a tree that opens shut hides what it was added for (#814).
    @Binding var shut: Set<Int>
    /// What the unbound page's `Connect a provider…` does. Inert by default, so a preview and a
    /// specimen draw the button without opening a panel behind the render.
    var connect: @MainActor () -> Void = {}
    /// The two things the room's chrome HOLDS rather than reads — the query in the window's row and
    /// the Mode in the ticket's band. Both outlive the pane, so both are held above the room; one
    /// value rather than two members, because a binding pair travels together (the `DeckSeams`
    /// shape).
    var held = Held.unheld

    struct Held {
        var query: Binding<String>
        var mode: Binding<SessionMode>

        /// Nothing remembers either, for a `#Preview` and a specimen with no window above them.
        static let unheld = Held(query: .constant(""), mode: .constant(.code))
    }

    var sidebar: some View {
        WorkSidebar(room: room, cockpitRoom: $cockpitRoom, view: $view)
    }

    /// What the room puts in the WINDOW's row: search, and nothing else. Everything that acts on a
    /// column is in that column's band, for the reason `WorkToolbar` records.
    var toolbar: WorkToolbar {
        WorkToolbar(reading: chrome, query: held.query)
    }

    /// Read ONCE and handed to both the band and the row above the ticket, so the count under the
    /// title and the controls that narrow it can never be two answers about one list.
    private var chrome: WorkChromeProjection.Reading {
        WorkChromeProjection.reading(of: room, in: view, showing: ticket)
    }

    /// The two panes, OR one of the room's two vacancies — never both.
    @ViewBuilder var deck: some View {
        if let vacancy = room.vacancy {
            WorkRoomVacancy(vacancy: vacancy, project: room.project, connect: connect)
        } else {
            HStack(spacing: ArgoSpacing.flush) {
                BacklogList(
                    rows: room.backlog,
                    selection: $ticket,
                    shut: $shut,
                    header: chrome,
                )
                DeckSeparator()
                TicketDetail(
                    ticket: room.ticket,
                    band: TicketBand(reading: chrome, mode: held.mode),
                ) { ticket = $0 }
            }
        }
    }
}

#Preview("Work room — the deck's two panes") {
    @Previewable @State var ticket: Int? = 272
    @Previewable @State var cockpitRoom = CockpitRoom.work
    @Previewable @State var view = WorkView.allOpen
    @Previewable @State var shut: Set<Int> = []

    WorkRoom(
        room: WorkFixture.room, cockpitRoom: $cockpitRoom, ticket: $ticket, view: $view,
        shut: $shut,
    )
    .deck
    .frame(width: ArgoBacklogList.width + ArgoTicketDetail.idealWidth, height: 620)
    .argoDeckSurface()
    .argoAppearance()
}

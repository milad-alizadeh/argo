import ArgoEngine
import SwiftUI

/// The Work room, as the PAIR of views the shell's split view slots take.
///
/// Not one `View`: `NavigationSplitView` owns its two slots, so a room fills them rather than
/// replacing them — which is what `cockpit-work-room.md` means by "it does not own a split of its
/// own". Both halves read the same `Room` value, so the sidebar's counts and the deck's rows can
/// never be two different answers.
///
/// `@MainActor` because it holds the row's verbs, and a closure a control calls is not `Sendable`.
@MainActor
struct WorkRoom {
    let room: WorkRoomProjection.Room
    /// Which room the strip in the sidebar's head is on — the whole window's, not this room's.
    @Binding var cockpitRoom: CockpitRoom
    /// Which ticket the deck is open on. Held above the room, because the ticket outlives the pane.
    @Binding var ticket: Int?
    /// Which view is open. Above the room too, and for a sharper reason: `room.backlog` is already
    /// filtered to it, so the selection has to be settled before the room is derived.
    @Binding var view: WorkView
    /// What the reader has dragged the seam between the two panes to. Above the room for the same
    /// reason the fold is: the panes are rebuilt on every ticket.
    @Binding var backlogWidth: CGFloat
    /// Which parents the reader has folded. Above the room for the same reason the ticket is: a
    /// fold outlives the pane. **Everything opens open**, so it is empty until somebody folds
    /// something — a tree that opens shut hides what it was added for (#814).
    @Binding var shut: Set<Int>
    /// What the unbound page's `Connect a provider…` does. Inert by default, so a preview and a
    /// specimen draw the button without opening a panel behind the render.
    var connect: @MainActor () -> Void = {}
    /// What the row's controls do, and what the one that writes through a provider renders (#275).
    /// Inert by default for the same reason `connect` is.
    var intents = WorkToolbarIntents.inert
    /// What the room's chrome HOLDS rather than reads — the query, which outlives the pane and is
    /// therefore held above the room. A value rather than the binding bare: it was a pair until the
    /// Mode chevron went (#872), and the search field is not the last thing this row will hold.
    var held = Held.unheld

    struct Held {
        var query: Binding<String>

        /// Nothing remembers it, for a `#Preview` and a specimen with no window above them.
        static let unheld = Held(query: .constant(""))
    }

    var sidebar: some View {
        WorkSidebar(room: room, cockpitRoom: $cockpitRoom, view: $view)
    }

    /// What the room puts in the WINDOW's row: every control the room has, on one line — the reason
    /// is `WorkToolbar`'s.
    var toolbar: WorkToolbar {
        WorkToolbar(reading: chrome, intents: intents, held: held)
    }

    /// Read ONCE and handed to both the list's heading and the row of controls above it, so the
    /// count under the title and the controls that narrow it can never be two answers about one
    /// list.
    private var chrome: WorkChromeProjection.Reading {
        WorkChromeProjection.reading(of: room, in: view, showing: ticket)
    }

    /// The two panes, OR one of the room's two vacancies — never both.
    @ViewBuilder var deck: some View {
        if let vacancy = room.vacancy {
            WorkRoomVacancy(vacancy: vacancy, project: room.project, connect: connect)
        } else {
            // The deck's own width, because the seam's ceiling is what is left after the ticket
            // detail's floor — `ArgoLayout.backlogLimits(in:)`.
            GeometryReader { deck in
                panes(in: deck.size.width)
            }
        }
    }

    /// The backlog, the seam the reader moves, and the ticket. The list keeps its heading; the
    /// controls are in the window's row above both (`WorkToolbar`), and the seam between them is
    /// the reader's (#844).
    ///
    /// The stored width is the reader's INTENT and is never written back — it is seated for the
    /// draw and left alone. Seating it in place looks like tidiness and is data loss: a window
    /// narrow for one layout pass clamps the number, and `seated` cannot tell a width that was
    /// clamped from one the reader chose, so widening the window again never brings it back. A
    /// pane dragged to 520 came back at its floor on every launch that sized the window twice.
    private func panes(in deck: CGFloat) -> some View {
        let limits = ArgoLayout.backlogLimits(in: deck)

        return HStack(spacing: ArgoSpacing.flush) {
            let seated = ArgoLayout.seated(backlogWidth, in: limits)
            BacklogList(
                rows: room.backlog,
                selection: $ticket,
                shut: $shut,
                header: chrome,
            )
            .frame(width: seated)
            // What the rows inside the `List` read to decide whether they have width for label
            // chips — see `ArgoBacklogList.labelsAppearAt`.
            .environment(\.backlogPaneWidth, seated)
            DeckSeam(width: $backlogWidth, limits: limits, growsRightward: true)
            TicketDetail(ticket: room.ticket) { ticket = $0 }
        }
    }
}

#Preview("Work room — the deck's two panes") {
    @Previewable @State var ticket: Int? = 272
    @Previewable @State var cockpitRoom = CockpitRoom.work
    @Previewable @State var view = WorkView.allOpen
    @Previewable @State var width = ArgoBacklogList.width
    @Previewable @State var shut: Set<Int> = []

    WorkRoom(
        room: WorkFixture.room, cockpitRoom: $cockpitRoom, ticket: $ticket, view: $view,
        backlogWidth: $width, shut: $shut,
    )
    .deck
    .frame(width: ArgoBacklogList.width + ArgoTicketDetail.idealWidth, height: 620)
    .argoDeckSurface()
    .argoAppearance()
}

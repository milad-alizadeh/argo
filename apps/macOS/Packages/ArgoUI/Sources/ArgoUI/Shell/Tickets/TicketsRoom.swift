import ArgoDesign
import ArgoEngine
import SwiftUI

/// The Tickets room, as the PAIR of views the shell's split view slots take.
///
/// Not one `View`: `NavigationSplitView` owns its two slots, so a room fills them rather than
/// replacing them — which is what `cockpit-work-room.md` means by "it does not own a split of its
/// own". Both halves read the same `Room` value, so the sidebar's counts and the deck's rows can
/// never be two different answers.
///
/// `@MainActor` because it holds the row's verbs, and a closure a control calls is not `Sendable`.
@MainActor
struct TicketsRoom {
    let room: TicketsRoomProjection.Room
    /// Which room the strip in the sidebar's head is on — the whole window's, not this room's.
    @Binding var cockpitRoom: CockpitRoom
    /// Which ticket the deck is open on. Held above the room, because the ticket outlives the pane.
    @Binding var ticket: Int?
    /// Which view is open. Above the room too, and for a sharper reason: `room.backlog` is already
    /// filtered to it, so the selection has to be settled before the room is derived.
    @Binding var view: TicketsView
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
    var intents = TicketsToolbarIntents.inert
    /// What the sidebar hero's Start raises, and what that press will send (#899). Not a value the
    /// room could build — a spawn reaches the engine, and the mapping needs the listing and the
    /// design tree, neither of which the room holds.
    var starting = StartIntent.inert
    /// The reads this room raises, none of them on a cadence. Inert by default, so a `#Preview`
    /// and a specimen draw the pane with no request behind them.
    var reads = Reads.inert

    /// Every read a room raises: one by the number a followed link named (#895), and the closed
    /// listing's own two (#1075). One value, because none of them is the poll's.
    struct Reads {
        /// What a link to a ticket the listing does not hold raises: one read, by that number.
        var follow: @MainActor (Int) async -> Void = { _ in }
        var closed = ClosedReads.inert

        static let inert = Reads()
    }

    /// The two acts behind the closed listing: opening the view, and asking for the page behind
    /// the one in hand. A pair rather than one closure taking a cursor — the room holds no cursor,
    /// and the ledger that does is the only thing that should.
    struct ClosedReads {
        var open: @MainActor () async -> Void
        var more: @MainActor () -> Void

        /// Nothing reads anything, for a `#Preview` and a specimen with no provider behind them.
        static let inert = ClosedReads(open: {}, more: {})

        /// What counts as an OPENING of the view — the pair a change of either half is one.
        struct Opening: Equatable {
            let view: TicketsView
            let project: String?
        }
    }

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
        TicketsSidebar(room: room, cockpitRoom: $cockpitRoom, view: $view, intents: nextUpIntents)
    }

    /// What the sidebar's hero performs (#898). Here rather than in the sidebar, because the hero
    /// writes the same binding a backlog row does — the view binding is deliberately not written,
    /// for the reason on `NextUpIntents.open`.
    var nextUpIntents: NextUpIntents {
        NextUpIntents(open: { ticket = $0 }, starting: starting)
    }

    /// What the room puts in the WINDOW's row: every control the room has, on one line — the reason
    /// is `TicketsToolbar`'s.
    var toolbar: TicketsToolbar {
        TicketsToolbar(reading: chrome, intents: intents, held: held)
    }

    /// Read ONCE and handed to both the list's heading and the row of controls above it, so the
    /// count under the title and the controls that narrow it can never be two answers about one
    /// list.
    private var chrome: TicketsChromeProjection.Reading {
        TicketsChromeProjection.reading(of: room, in: view, showing: ticket)
    }

    /// The two panes, OR one of the room's vacancies — never both.
    var deck: some View {
        pages
            // OUTSIDE the vacancy branch, deliberately. Until the closed read lands the room is its
            // own `unread` vacancy, so a task inside the branch that draws the rows would be
            // waiting on the read that is waiting on it.
            //
            // Keyed on the view AND the Project, which is what "opening the view is the only thing
            // that reads the closed set" means: every switch INTO `Closed` reads its first page,
            // and no tick ever does (#1075). The Project is in the key because switching one while
            // sitting in `Closed` moves no view — a reader would otherwise be left on the `unread`
            // page until they navigated away and back.
            .task(id: ClosedReads.Opening(view: room.opened.view, project: room.project)) {
                guard room.opened.view.source == .closed else { return }
                await reads.closed.open()
            }
    }

    @ViewBuilder private var pages: some View {
        if let vacancy = room.vacancy {
            TicketsRoomVacancy(vacancy: vacancy, project: room.project, connect: connect)
        } else {
            // The deck's own width, because the seam's ceiling is what is left after the ticket
            // detail's floor — `ArgoLayout.backlogLimits(in:)`.
            GeometryReader { deck in
                panes(in: deck.size.width)
            }
            // Keyed on the number, so one ticket a reader followed costs one read: the task is
            // not re-run while the deck stays open on it.
            .task(id: room.unreadNumber) {
                guard let unread = room.unreadNumber else { return }
                await reads.follow(unread)
            }
        }
    }

    /// The backlog, the seam the reader moves, and the ticket. The list keeps its heading; the
    /// controls are in the window's row above both (`TicketsToolbar`), and the seam between them is
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
                held: BacklogList.Held(selection: $ticket, shut: $shut),
                header: chrome,
                // Only where the provider said there IS another page. A `Load more` that survived
                // the last one is the control-that-does-nothing this room keeps refusing (#900).
                more: room.opened.closedHasMore ? reads.closed.more : nil,
            )
            .frame(width: seated)
            // What the rows inside the `List` read to decide whether they have width for label
            // chips — see `ArgoBacklogList.labelsAppearAt`.
            .environment(\.backlogPaneWidth, seated)
            DeckSeam(width: $backlogWidth, limits: limits, growsRightward: true)
            TicketDetail(ticket: room.ticket, unreadNumber: room.unreadNumber) { ticket = $0 }
        }
    }
}

#Preview("Tickets room — the deck's two panes") {
    @Previewable @State var ticket: Int? = 272
    @Previewable @State var cockpitRoom = CockpitRoom.tickets
    @Previewable @State var view = TicketsView.allOpen
    @Previewable @State var width = ArgoBacklogList.width
    @Previewable @State var shut: Set<Int> = []

    TicketsRoom(
        room: TicketsFixture.room, cockpitRoom: $cockpitRoom, ticket: $ticket, view: $view,
        backlogWidth: $width, shut: $shut,
    )
    .deck
    .frame(width: ArgoBacklogList.width + ArgoTicketDetail.idealWidth, height: 620)
    .argoDeckSurface()
    .argoAppearance()
}

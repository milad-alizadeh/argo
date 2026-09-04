import ArgoEngine
import Foundation

/// The Tickets room as one value: the sidebar's views, the backlog's rows, and the ticket
/// the deck is open on.
///
/// The sidebar's counts are arithmetic over the SAME list the deck draws, computed here once. Two
/// surfaces counting the same set separately is how a rail comes to disagree with the rows beside
/// it, and no render shows that.
package enum TicketsRoomProjection {
    package struct Room: Sendable, Equatable {
        let views: [ViewReading]
        let provider: TicketsProvider?
        package let backlog: [Row]
        package let ticket: Detail?
        /// The number the deck is open on that nothing has been read for — a link followed to a
        /// ticket the listing does not hold, which is every closed one (#895). `nil` wherever
        /// `ticket` has something, so the pane draws one or the other and never both.
        package let unreadNumber: Int?
        /// The Project the window is scoped to. Carried for the vacancy pages, which name it.
        let project: String?
        /// What the view this room was derived in answers about itself (#1075).
        let opened: Opened
        /// What the sidebar's hero states. Absent with nothing bound, where the room hides whole —
        /// a backlog-clear sentence under an unbound provider would answer a question nobody asked.
        package let nextUp: NextUp?
        /// What the search field's query has done to `backlog`, and `nil` where nothing is typed
        /// (#873). Here, so the heading's count and the rows under it come off one value.
        var narrowing: Narrowing?

        func view(_ kind: TicketsView) -> ViewReading? {
            views.first { $0.id == kind }
        }

        /// Which of the room's nothings this room is, and `nil` where it has something to draw
        /// (#818, #1075). Both halves read this one, so the sidebar and the deck cannot disagree.
        ///
        /// The set it is a nothing ABOUT is the view's own: an empty open listing is not `Closed`'s
        /// nothing, and a repository where every ticket is finished must still be able to show the
        /// view that says so.
        package var vacancy: Vacancy? {
            guard let provider else { return .unbound }
            guard !opened.hasItems else { return nil }
            // An empty listing is not an answer until one has landed. Saying "everything is closed"
            // over a read that never arrived — a launch mid-flight, or a Binding that has been
            // failing all session — is the false DIRECT the tier rules exist to refuse
            // (`CONTEXT.md` L2 · degrade-down).
            guard hasAnswered else { return .unread(provider: provider.name) }
            switch opened.view.source {
            case .open: return .nothingOpen(provider: provider.name)
            case .closed: return .nothingClosed(provider: provider.name)
            }
        }

        /// Whether the read this view's set comes from has landed — the poll for four of the views,
        /// and its own bounded read for `Closed`, which no tick ever makes.
        private var hasAnswered: Bool {
            switch opened.view.source {
            case .open: provider?.hasAnswered == true
            case .closed: opened.closedWasRead
            }
        }

        /// Nothing read, and nothing bound. The room a deck draws before anything has answered —
        /// distinct from a provider that answered with an empty backlog, which keeps its views.
        static func vacant(in project: String? = nil) -> Room {
            Room(
                views: [], provider: nil, backlog: [], ticket: nil, unreadNumber: nil,
                project: project, opened: .vacant, nextUp: nil,
            )
        }
    }

    /// The room with nothing to draw, and which nothing it is (#818, #820). `unbound` and `unread`
    /// name no count anywhere — nothing was read, so every number would be invented; `nothingOpen`
    /// names the provider that answered.
    package enum Vacancy: Sendable, Equatable {
        case unbound
        /// Bound, and nothing has come back yet. Neither of the other two: there IS a provider, so
        /// `Connect a provider…` would be the wrong act, and nobody has answered, so an empty
        /// backlog is not a thing anyone may claim.
        case unread(provider: String)
        case nothingOpen(provider: String)
        /// The closed read answered, and the provider has nothing closed to show (#1075). Its own
        /// case rather than `nothingOpen` with a different word: "everything is closed" and
        /// "nothing has ever been closed" are opposite facts about one Project, and a page that
        /// said either for the other would be worse than no page.
        case nothingClosed(provider: String)
    }

    /// What the room's own VIEW answers about itself: which view it is, whether that view's set
    /// served anything at all, and — for the one view with a read of its own — whether that read
    /// has answered and has a page behind it.
    ///
    /// One value because they are one reading: every field here is about the set the open view is
    /// defined over, and the room's nothing cannot be decided without all four (#1075).
    struct Opened: Sendable, Equatable {
        let view: TicketsView
        /// Whether the set this view is defined over served anything AT ALL — the open listing for
        /// four of them, the closed one for the fifth. `backlog` cannot answer it: that is already
        /// filtered to the view and narrowed by whatever is typed.
        let hasItems: Bool
        /// Whether the closed read has ANSWERED for this Project. The same fact the `Closed` count
        /// rests on (`TicketsView.Ground.closedListing`) — the poll's own `hasAnswered` cannot say
        /// it, because no tick makes that read.
        let closedWasRead: Bool
        /// Whether the provider says there is another page behind the closed tickets in hand —
        /// what the `Load more` row reads to decide whether it draws at all.
        let closedHasMore: Bool

        /// The room a deck draws before anything has answered.
        static let vacant = Opened(
            view: .allOpen, hasItems: false, closedWasRead: false, closedHasMore: false,
        )
    }

    /// One sidebar view and what it holds. The count is ABSENT where the provider has not said
    /// enough to arrive at one — a view reading zero is a claim, and `Blocked` reading zero over a
    /// backlog whose edges nobody served is the loudest false one there is (#820).
    struct ViewReading: Sendable, Equatable, Identifiable {
        let id: TicketsView
        let count: Int?
        /// What the count is SHORT by — how many live Sessions this view's join could not place
        /// (#1074). Zero on every view whose ground is not the claims.
        var unplaced = 0
    }

    /// What a row's blockage mark carries (#896). Built only where there is something to mark, so
    /// `count` is never zero and the type has no case for "nothing" — `blockage(of:)` returns `nil`
    /// there instead.
    package struct Blockage: Sendable, Equatable {
        /// How many blockers still stand. A COUNT and not a flag: blocked by three and blocked by
        /// one are different distances from startable.
        let count: Int
        /// Whether one of those blockers was ruled out, so no amount of waiting clears the edge and
        /// a human has to re-scope one of the two. It picks the mark's ink, nothing else.
        let isStranded: Bool

        /// Spelled out because Swift synthesises no memberwise initializer above
        /// `internal`, and the specimens build this from their own target (#1085).
        package init(count: Int, isStranded: Bool) {
            self.count = count
            self.isStranded = isStranded
        }
    }

    /// The marks a row's trailing region can carry. They do not contend: a closed ticket's edges
    /// are not read at all, and one still in the open set has no closure to draw.
    struct Marks: Sendable, Equatable {
        /// Whether a LIVE Session is on this ticket (#1074). Off the same `TicketClaims.numbers`
        /// the sidebar's `In progress` counts, and `TicketsBacklogMarkTests` holds the two in step
        /// over the whole open set — the way it already does for `blockage`.
        ///
        /// False on every CLOSED row, whatever view it stands in (#1191). The claim outlives the
        /// closure — a Session does not stop because its ticket did — so the number stays claimed
        /// and the row is the wrong place to say so: `TicketState` settles which of the two wins.
        var isClaimed = false
        /// What the blockage mark draws, and `nil` where it draws none (#896).
        ///
        /// The mark and the sidebar's `Blocked` count are two readings of ONE engine fact,
        /// `Ticket.blockedBy`, through two shapes of it: this counts what still stands, and
        /// `TicketsView.admits` asks which side of the partition the ticket falls. They cannot
        /// drift apart silently — `TicketsBacklogMarkTests` holds them in step over the whole open
        /// set, which is the check that makes the pair worth having in two shapes.
        var blockage: Blockage?
        /// How this ticket stopped being open, and `nil` on an open one — what keeps `resolved`
        /// and `ruledOut` apart on the row rather than folding both into "closed" (#1075).
        var closure: TicketClosure?

        static let none = Marks()
    }

    /// One row of the backlog: `twist · dot · id · title`, plus the trailing region.
    package struct Row: Sendable, Equatable, Identifiable {
        package let id: Int
        let title: String
        let delivery: DeliveryReading
        /// The parent's `n/m` roll-up, and `nil` on a leaf. It counts the TRACKER's children rather
        /// than the rows beside it, so `2/9` over five visible rows is correct.
        let trailing: String?
        /// The provider's own priority word, absent where nothing was read. It BANDS a root and
        /// it is what a child states when the band's header disagrees with it (#819).
        let priority: String?
        /// The provider's own labels, verbatim and in the order it served them. The row draws the
        /// first `ArgoBacklogList.labelLimit` of them — what distinguishes one ticket from the next
        /// belongs on the row, not only in the pane beside it.
        let labels: [TicketLabel]
        /// The rows nested under this one, from the child edge
        /// (`TicketsRoomProjection+Tree.swift`). Empty on a leaf, and empty on a parent whose every
        /// child the view filtered out.
        var children: [Row]
        /// The marks the trailing region can carry.
        let marks: Marks
        /// When the provider last saw this ticket change, and `nil` where it served no date at all
        /// — in which case the row draws none rather than inventing one (#897). LAST TOUCHED and
        /// not filed: `Ticket.updatedAt` is the only date any adapter reads.
        let touched: Date?
        /// Whether this row is on screen only because something under it matched the query — always
        /// false where nothing is narrowing, so an unsearched list has no rails in it (#873).
        package var isRail = false
    }

    /// With no provider bound the room is VACANT rather than empty — no views, no list, no ticket
    /// (#272). Four views all reading zero would say the backlog is clear, which is a claim nobody
    /// has the standing to make when nobody was asked.
    ///
    /// `matching` is the search field's query, and it narrows LAST: the view chooses the set and
    /// the query narrows within it, which is the order `cockpit-work-room.md` fixes and the order
    /// the heading reads in.
    ///
    /// Everything but the selection comes off `TicketsRoomMemo`, which is what makes CLICKING a
    /// ticket a lookup rather than a second pass over the listing (ADR-0028 Rule 1). The detail is
    /// derived here on every pass, from the live `showing`, so a remembered room never draws a
    /// remembered ticket.
    @MainActor
    package static func room(
        from reading: TicketsReading,
        in view: TicketsView = .allOpen,
        matching query: String = "",
    )
        -> Room {
        guard reading.provider != nil else { return .vacant(in: reading.project) }
        let stamp = TicketsRoomMemo.Stamp(of: reading, in: view, matching: query)
        let held = TicketsRoomMemo.held(at: stamp) {
            // The STAMP's reading, whose selection is cleared, and never the caller's: what is
            // remembered must not be able to read the number it is remembered across.
            unopened(from: stamp.reading, in: view, matching: query)
        }
        return held.room.showing(ticket(reading.showing, in: held.listing), at: reading.showing)
    }

    /// The room with nothing open — every field the selected number is not an input to. Taken once
    /// per stamp and remembered; `room(from:in:matching:)` above opens it.
    @MainActor
    private static func unopened(
        from reading: TicketsReading,
        in view: TicketsView,
        matching query: String,
    )
        -> Room {
        let sets = Sets.of(reading)
        let shown = items(of: sets, in: view)
        let search = Query.typed(query).map { narrowed(shown, to: $0) }
        let rows = tree(of: search?.items ?? shown, in: view, reading: reading)
        return Room(
            views: views(of: sets),
            provider: reading.provider,
            backlog: search.map { railed(rows, matching: $0.hits) } ?? rows,
            ticket: nil,
            unreadNumber: nil,
            project: reading.project,
            opened: Opened(
                view: view,
                // The VIEW's own set, before the query narrowed it: opening `Closed` on a Project
                // with nothing open must draw the closed rows, not the open set's nothing.
                hasItems: !sets.items(for: view.source).isEmpty,
                closedWasRead: sets.closedWasRead,
                // Only in the view the page is behind. `Load more` in `All open` would grow the
                // list with rows that view cannot hold — the control-that-does-nothing, one
                // worse (#900).
                closedHasMore: view.source == .closed && reading.closedListing?.hasMore == true,
            ),
            // Over the whole open set, never the view on screen: the hero answers "what should I
            // pick up", and opening `Blocked` must not turn that into "nothing is unblocked".
            nextUp: reading.nextUp(of: sets.open),
            narrowing: search?.narrowing,
        )
    }
}

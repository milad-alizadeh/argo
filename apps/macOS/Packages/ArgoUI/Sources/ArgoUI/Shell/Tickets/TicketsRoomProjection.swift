import ArgoEngine
import Foundation

/// The Tickets room as one value: the sidebar's views, the backlog's rows, and the ticket
/// the deck is open on.
///
/// The sidebar's counts are arithmetic over the SAME list the deck draws, computed here once. Two
/// surfaces counting the same set separately is how a rail comes to disagree with the rows beside
/// it, and no render shows that.
enum TicketsRoomProjection {
    struct Room: Sendable, Equatable {
        let views: [ViewReading]
        let provider: TicketsProvider?
        let backlog: [Row]
        let ticket: Detail?
        /// The number the deck is open on that nothing has been read for — a link followed to a
        /// ticket the listing does not hold, which is every closed one (#895). `nil` wherever
        /// `ticket` has something, so the pane draws one or the other and never both.
        let unreadNumber: Int?
        /// The Project the window is scoped to. Carried for the vacancy pages, which name it.
        let project: String?
        /// Which view this room was derived in. Stored rather than passed alongside, because the
        /// room's own nothing depends on it: an empty OPEN set is not `Closed`'s nothing (#1075).
        let view: TicketsView
        /// Whether the set this room's view is defined over served anything AT ALL — the open
        /// listing for four of them, the closed one for the fifth. A fact about the whole set,
        /// which no other field here can answer: `backlog` is already filtered to the view on
        /// screen and narrowed by whatever is typed.
        let hasItems: Bool
        /// Whether the provider says there is another page of closed tickets behind the ones in
        /// hand — what the `Load more` row at the foot of the closed list reads to decide whether
        /// it draws at all (#1075).
        let closedHasMore: Bool
        /// Whether the closed read has ANSWERED for this Project. The same fact the `Closed` count
        /// rests on (`TicketsView.Ground.closedListing`), read here for the page that says so —
        /// the poll's own `hasAnswered` cannot, because no tick makes this read.
        let closedWasRead: Bool
        /// What the sidebar's hero states. Absent with nothing bound, where the room hides whole —
        /// a backlog-clear sentence under an unbound provider would answer a question nobody asked.
        let nextUp: NextUp?
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
        var vacancy: Vacancy? {
            guard let provider else { return .unbound }
            guard !hasItems else { return nil }
            // An empty listing is not an answer until one has landed. Saying "everything is closed"
            // over a read that never arrived — a launch mid-flight, or a Binding that has been
            // failing all session — is the false DIRECT the tier rules exist to refuse
            // (`CONTEXT.md` L2 · degrade-down).
            guard hasAnswered else { return .unread(provider: provider.name) }
            return view.source == .open
                ? .nothingOpen(provider: provider.name)
                : .nothingClosed(provider: provider.name)
        }

        /// Whether the read this view's set comes from has landed — the poll for four of the views,
        /// and its own bounded read for `Closed`, which no tick ever makes.
        private var hasAnswered: Bool {
            view.source == .open ? provider?.hasAnswered == true : closedWasRead
        }

        /// Nothing read, and nothing bound. The room a deck draws before anything has answered —
        /// distinct from a provider that answered with an empty backlog, which keeps its views.
        static func vacant(in project: String? = nil) -> Room {
            Room(
                views: [], provider: nil, backlog: [], ticket: nil, unreadNumber: nil,
                project: project, view: .allOpen,
                hasItems: false, closedHasMore: false, closedWasRead: false, nextUp: nil,
            )
        }
    }

    /// The room with nothing to draw, and which nothing it is (#818, #820). `unbound` and `unread`
    /// name no count anywhere — nothing was read, so every number would be invented; `nothingOpen`
    /// names the provider that answered.
    enum Vacancy: Sendable, Equatable {
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
    struct Blockage: Sendable, Equatable {
        /// How many blockers still stand. A COUNT and not a flag: blocked by three and blocked by
        /// one are different distances from startable.
        let count: Int
        /// Whether one of those blockers was ruled out, so no amount of waiting clears the edge and
        /// a human has to re-scope one of the two. It picks the mark's ink, nothing else.
        let isStranded: Bool
    }

    /// One row of the backlog: `twist · dot · id · title`, plus the trailing region.
    struct Row: Sendable, Equatable, Identifiable {
        let id: Int
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
        /// What the blockage mark draws, and `nil` where it draws none (#896).
        ///
        /// The mark and the sidebar's `Blocked` count are two readings of ONE engine fact,
        /// `Ticket.blockedBy`, through two shapes of it: this counts what still stands, and
        /// `TicketsView.admits` asks which side of the partition the ticket falls. They cannot
        /// drift apart silently — `TicketsBacklogMarkTests` holds them in step over the whole open
        /// set, which is the check that makes the pair worth having in two shapes.
        let blockage: Blockage?
        /// Whether a LIVE Session is on this ticket (#1074). Off the same `TicketClaims.numbers`
        /// the sidebar's `In progress` counts, and `TicketsBacklogMarkTests` holds the two in step
        /// over the whole open set — the way it already does for `blockage`.
        var isClaimed = false
        /// When the provider last saw this ticket change, and `nil` where it served no date at all
        /// — in which case the row draws none rather than inventing one (#897). LAST TOUCHED and
        /// not filed: `Ticket.updatedAt` is the only date any adapter reads.
        let touched: Date?
        /// How this ticket stopped being open, and `nil` on an open one — the mark that keeps
        /// `resolved` and `ruledOut` apart on the row rather than folding both into "closed"
        /// (#1075). Absent on every row of the four open views, which is why it is not a word.
        let closure: TicketClosure?
        /// Whether this row is on screen only because something under it matched the query — always
        /// false where nothing is narrowing, so an unsearched list has no rails in it (#873).
        var isRail = false
    }

    /// With no provider bound the room is VACANT rather than empty — no views, no list, no ticket
    /// (#272). Four views all reading zero would say the backlog is clear, which is a claim nobody
    /// has the standing to make when nobody was asked.
    ///
    /// `matching` is the search field's query, and it narrows LAST: the view chooses the set and
    /// the query narrows within it, which is the order `cockpit-work-room.md` fixes and the order
    /// the heading reads in.
    static func room(
        from reading: TicketsReading,
        in view: TicketsView = .allOpen,
        matching query: String = "",
    )
        -> Room {
        guard reading.provider != nil else { return .vacant(in: reading.project) }
        let sets = Sets.of(reading)
        let shown = items(of: sets, in: view)
        let search = Query.typed(query).map { narrowed(shown, to: $0) }
        let rows = tree(of: search?.items ?? shown, in: view, reading: reading)
        let opened = ticket(in: reading)
        return Room(
            views: views(of: sets),
            provider: reading.provider,
            backlog: search.map { railed(rows, matching: $0.hits) } ?? rows,
            ticket: opened,
            unreadNumber: opened == nil ? reading.showing : nil,
            project: reading.project,
            view: view,
            // The VIEW's own set, before the query narrowed it: opening `Closed` on a Project with
            // nothing open must draw the closed rows rather than the open set's nothing.
            hasItems: !(view.source == .open ? sets.open : sets.closed).isEmpty,
            closedHasMore: reading.closedListing?.hasMore == true,
            closedWasRead: sets.closedWasRead,
            // Over the whole open set, never the view on screen: the hero answers "what should I
            // pick up", and opening `Blocked` must not turn that into "nothing is unblocked".
            nextUp: reading.nextUp(of: sets.open),
            narrowing: search?.narrowing,
        )
    }
}

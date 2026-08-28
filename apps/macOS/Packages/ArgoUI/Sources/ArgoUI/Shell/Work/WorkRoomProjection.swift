import ArgoEngine

/// The Work room as one value: the sidebar's views, the backlog's rows, and the ticket
/// the deck is open on.
///
/// The sidebar's counts are arithmetic over the SAME list the deck draws, computed here once. Two
/// surfaces counting the same set separately is how a rail comes to disagree with the rows beside
/// it, and no render shows that.
enum WorkRoomProjection {
    struct Room: Sendable, Equatable {
        let views: [ViewReading]
        let provider: WorkProvider?
        let backlog: [Row]
        let ticket: Ticket?
        /// The Project the window is scoped to. Carried for the vacancy pages, which name it.
        let project: String?
        /// Whether the provider served anything open AT ALL. A fact about the whole open set, which
        /// no other field here can answer: `backlog` is already filtered to the view on screen.
        let hasOpenWork: Bool
        /// What the sidebar's hero states. Absent with nothing bound, where the room hides whole —
        /// a backlog-clear sentence under an unbound provider would answer a question nobody asked.
        let nextUp: NextUp?
        /// What the search field's query has done to `backlog`, and `nil` where nothing is typed
        /// (#873). Here rather than beside the field, because the count the heading states has to
        /// be the count of what the query left — the two coming from different places is how a
        /// heading comes to disagree with the rows under it.
        var narrowing: Narrowing?

        func view(_ kind: WorkView) -> ViewReading? {
            views.first { $0.id == kind }
        }

        /// Which of the room's two nothings this room is, and `nil` where it has something to draw
        /// (#818). Both halves read this one, so the sidebar and the deck cannot disagree.
        var vacancy: Vacancy? {
            guard let provider else { return .unbound }
            guard !hasOpenWork else { return nil }
            // An empty listing is not an answer until one has landed. Saying "everything is closed"
            // over a read that never arrived — a launch mid-flight, or a Binding that has been
            // failing all session — is the false DIRECT the tier rules exist to refuse
            // (`CONTEXT.md` L2 · degrade-down).
            guard provider.hasAnswered else { return .unread(provider: provider.name) }
            return .nothingOpen(provider: provider.name)
        }

        /// Nothing read, and nothing bound. The room a deck draws before anything has answered —
        /// distinct from a provider that answered with an empty backlog, which keeps its views.
        static func vacant(in project: String? = nil) -> Room {
            Room(
                views: [], provider: nil, backlog: [], ticket: nil, project: project,
                hasOpenWork: false, nextUp: nil,
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
    }

    /// One sidebar view and what it holds. The count is ABSENT where the provider has not said
    /// enough to arrive at one — a view reading zero is a claim, and `Blocked` reading zero over a
    /// backlog whose edges nobody served is the loudest false one there is (#820).
    struct ViewReading: Sendable, Equatable, Identifiable {
        let id: WorkView
        let count: Int?
    }

    /// One row of the backlog: `twist · dot · id · title`, plus one trailing fact.
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
        let labels: [WorkItemLabel]
        /// The rows nested under this one, from the child edge (`WorkRoomProjection+Tree.swift`).
        /// Empty on a leaf, and empty on a parent whose every child the view filtered out.
        var children: [Row]
        /// Whether this row is on screen only because something under it matched the query (#873).
        /// Always false where nothing is narrowing, so the flag says "kept for a descendant" rather
        /// than "did not match" — an unsearched list has neither matches nor rails in it.
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
        from reading: WorkReading,
        in view: WorkView = .allOpen,
        matching query: String = "",
    )
        -> Room {
        guard reading.provider != nil else { return .vacant(in: reading.project) }
        let open = reading.items.filter { $0.closure == .open }
        let closed = Set(reading.items.filter { $0.closure != .open }.map(\.number))
        let shown = items(of: open, in: view, claimed: reading.claimed)
        let search = Query.typed(query).map { (query: $0, result: narrowed(shown, to: $0)) }
        let rows = tree(of: search?.result.items ?? shown, reading: reading, closed: closed)
        return Room(
            views: views(of: open, claimed: reading.claimed),
            provider: reading.provider,
            backlog: search.map { railed(rows, matching: $0.result.hits) } ?? rows,
            ticket: ticket(in: reading),
            project: reading.project,
            hasOpenWork: !open.isEmpty,
            // Over the whole open set, never the view on screen: the hero answers "what should I
            // pick up", and opening `Blocked` must not turn that into "nothing is unblocked".
            nextUp: reading.nextUp(of: open),
            narrowing: search.map {
                Narrowing(query: $0.query.raw, matches: $0.result.hits.count)
            },
        )
    }
}

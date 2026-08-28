import ArgoEngine

/// The Work room as one value: the sidebar's views and charts, the backlog's rows, and the ticket
/// the deck is open on.
///
/// The sidebar's counts are arithmetic over the SAME list the deck draws, computed here once. Two
/// surfaces counting the same set separately is how a rail comes to disagree with the rows beside
/// it, and no render shows that.
enum WorkRoomProjection {
    struct Room: Sendable, Equatable {
        let views: [ViewReading]
        let charts: [ChartReading]
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
        /// The chart the deck is SCOPED to, and `nil` on a view — where the deck draws the backlog
        /// and the ticket beside it, exactly as it did (#335).
        let chart: ChartScope?

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
                views: [], charts: [], provider: nil, backlog: [], ticket: nil, project: project,
                hasOpenWork: false, nextUp: nil, chart: nil,
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

    /// One PRD-shaped parent in the `CHARTS` group — the entry point to its Route.
    struct ChartReading: Sendable, Equatable, Identifiable {
        let id: Int
        /// The parent's number and the head of its title, which is what fits the rail.
        let name: String
        /// How many of its children are open AND were read. It undercounts a chart whose children
        /// the poll has not reached, which is the quieter of the two ways to be wrong.
        let count: Int
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
        /// The rows nested under this one, from the child edge (`WorkRoomProjection+Tree.swift`).
        /// Empty on a leaf, and empty on a parent whose every child the view filtered out.
        let children: [Row]
    }

    /// With no provider bound the room is VACANT rather than empty — no views, no list, no ticket
    /// (#272). Four views all reading zero would say the backlog is clear, which is a claim nobody
    /// has the standing to make when nobody was asked.
    static func room(from reading: WorkReading, in view: WorkView = .allOpen, chart: Int? = nil)
        -> Room {
        guard reading.provider != nil else { return .vacant(in: reading.project) }
        let open = reading.items.filter { $0.closure == .open }
        let closed = Set(reading.items.filter { $0.closure != .open }.map(\.number))
        // Scoped to the chart where the rail is on one, and to the view otherwise. The view is
        // still WHAT IT WAS while a chart is up — the rail's counts go on stating it, and leaving
        // the chart puts the reader back on the rows they left (#335).
        let shown = chart.map { scoped(open, to: $0) }
            ?? items(of: open, in: view, claimed: reading.claimed)
        return Room(
            views: views(of: open, claimed: reading.claimed),
            charts: charts(of: reading, open: open),
            provider: reading.provider,
            backlog: tree(of: shown, reading: reading, closed: closed),
            ticket: ticket(in: reading),
            project: reading.project,
            hasOpenWork: !open.isEmpty,
            // Over the whole open set, never the view on screen: the hero answers "what should I
            // pick up", and opening `Blocked` must not turn that into "nothing is unblocked".
            nextUp: reading.nextUp(of: open),
            chart: chartScope(chart, in: reading),
        )
    }
}

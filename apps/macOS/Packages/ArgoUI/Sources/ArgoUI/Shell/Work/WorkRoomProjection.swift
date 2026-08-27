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

        func view(_ kind: WorkView) -> ViewReading? {
            views.first { $0.id == kind }
        }

        /// Nothing read, and nothing bound. The room a deck draws before anything has answered —
        /// distinct from a provider that answered with an empty backlog, which keeps its views.
        static let vacant = Room(views: [], charts: [], provider: nil, backlog: [], ticket: nil)
    }

    /// One sidebar view and what it holds.
    struct ViewReading: Sendable, Equatable, Identifiable {
        let id: WorkView
        let count: Int
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

    /// One flat row of the backlog: `dot · id · title`, plus one trailing fact.
    struct Row: Sendable, Equatable, Identifiable {
        let id: Int
        let title: String
        let delivery: DeliveryReading
        /// The parent's `n/m` roll-up, and `nil` on a leaf. It counts the tracker's children, not
        /// the rows beside it, so `2/9` over five visible rows is correct.
        let trailing: String?
    }

    /// With no provider bound the room is VACANT rather than empty — no views, no list, no ticket
    /// (#272). Four views all reading zero would say the backlog is clear, which is a claim nobody
    /// has the standing to make when nobody was asked.
    static func room(from reading: WorkReading, in view: WorkView = .allOpen) -> Room {
        guard reading.provider != nil else { return .vacant }
        let open = reading.items.filter { $0.closure == .open }
        let closed = Set(reading.items.filter { $0.closure != .open }.map(\.number))
        let shown = items(of: open, in: view, claimed: reading.claimed)
        return Room(
            views: views(of: open, claimed: reading.claimed),
            charts: charts(of: reading, open: open),
            provider: reading.provider,
            backlog: shown
                .map { row(for: $0, delivery: reading.deliveries[$0.number], closed: closed) },
            ticket: ticket(in: reading),
        )
    }
}

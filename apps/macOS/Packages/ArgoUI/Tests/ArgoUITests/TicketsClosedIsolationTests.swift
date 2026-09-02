import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// What the `Closed` view must NOT change (#1075).
///
/// Its own half is `TicketsClosedViewTests`. This half is the ticket's fourth criterion: every
/// reading defined over the open set is still defined over the open set with a closed listing in
/// hand, and the room's other nothings still say which nothing they are.
@Suite("The Closed view changes nothing else")
struct TicketsClosedIsolationTests {
    private func room(
        _ reading: TicketsReading = TicketsFixture.closedRead,
        in view: TicketsView = .closed,
        matching query: String = "",
    )
        -> TicketsRoomProjection.Room {
        TicketsRoomProjection.room(from: reading, in: view, matching: query)
    }

    private func drawn(_ room: TicketsRoomProjection.Room) -> [TicketsRoomProjection.Drawn] {
        TicketsRoomProjection.drawn(room.backlog, shut: [])
    }

    /// These items, with the closed read having answered with every closed one of them.
    private static func listed(_ items: [Ticket]) -> TicketsReading {
        var reading = TicketsFixture.reading(of: items)
        reading.closedListing = TicketsReading.ClosedListingReading(
            numbers: Set(items.filter { $0.closure != .open }.map(\.number)),
            hasMore: false,
        )
        return reading
    }

    /// The hero answers "what should I pick up", and a finished ticket is not an answer to it.
    @Test
    func `next up never offers a closed ticket`() {
        let closedNumbers = Set(
            TicketsFixture.closedRead.items.filter { $0.closure != .open }.map(\.number),
        )

        for view in TicketsView.allCases {
            guard case let .pick(offered)? = room(in: view).nextUp else { continue }
            #expect(!closedNumbers.contains(offered.number))
        }
    }

    /// The counts are over each view's own set, so a closed read landing must move exactly one of
    /// them — the fifth — and leave the four the poll answers where they were.
    @Test
    func `the closed read moves no count but its own`() {
        let before = room(TicketsFixture.reading, in: .allOpen).views
        let after = room(TicketsFixture.closedRead, in: .allOpen).views

        #expect(before.dropLast() == after.dropLast())
        #expect(before.last?.count == nil)
        #expect(after.last?.count != nil)
    }

    /// A closed listing read WITHOUT edges must not turn `Unblocked` and `Blocked` absent: those
    /// rest on every OPEN ticket's edges having been served, and a closed one is not in that set.
    @Test
    func `edgeless closed tickets do not make the edge-counted views absent`() {
        var reading = TicketsFixture.closedRead
        reading.items += [Ticket(
            number: 901, title: "Closed, no edges read", status: "Done", closure: .resolved,
            blockedBy: nil,
        )]
        let counts = room(reading, in: .allOpen)

        #expect(counts.view(.unblocked)?.count != nil)
        #expect(counts.view(.blocked)?.count != nil)
    }

    // MARK: - #895's residue

    /// The roll-up counts the TRACKER's children, so an open parent's `n/m` is only right once the
    /// closed children are in hand — which is what putting the closed listing in `items` buys.
    @Test
    func `an open parent counts the closed children now in hand`() {
        let parent = Ticket(
            number: 607, title: "A parent", status: "Todo", closure: .open,
            children: [1, 2, 3, 4],
        )
        let child = { (number: Int, closure: TicketClosure) in
            Ticket(number: number, title: "A child", status: "x", closure: closure)
        }
        var reading = TicketsFixture.closedRead
        reading.items = [parent, child(1, .open), child(2, .resolved), child(3, .ruledOut)]

        // Two of four closed and in hand; the fourth is a child the poll has not reached, and it
        // counts in the denominator without being claimed as either.
        #expect(room(reading, in: .allOpen).backlog.first?.trailing == "2/4")
    }

    /// And a CLOSED parent counts them too. Its children come from whatever the provider served
    /// beside it — nothing on GitHub, where the closed read asks for no edges, and the fragment's
    /// own `children` on Linear, where they cost no second request.
    @Test
    func `a closed parent counts the closed children beside it`() {
        let parent = Ticket(
            number: 607, title: "A finished parent", status: "Done", closure: .resolved,
            children: [1, 2],
        )
        let reading = Self.listed([
            parent,
            Ticket(number: 1, title: "A child", status: "Done", closure: .resolved),
            Ticket(number: 2, title: "A child", status: "Todo", closure: .open),
        ])

        #expect(room(reading).backlog.first { $0.id == 607 }?.trailing == "1/2")
    }

    /// A ticket the closed read answered with can be REOPENED before the reader looks again, and
    /// the poll's fresher copy then wins in the ledger. It must leave the view with it: a row
    /// counted under `Closed` that draws no closure word is claiming one that was withdrawn.
    @Test
    func `a ticket reopened since the read leaves the closed view`() throws {
        var reading = Self.listed([
            Ticket(number: 900, title: "Was closed", status: "Done", closure: .resolved),
        ])
        reading.items = [Ticket(
            number: 900, title: "Reopened", status: "Todo", closure: .open,
        )]

        let closed = room(reading)
        // A zero and not an absence: the read DID answer, and what it answered with has reopened.
        let counted = try #require(closed.view(.closed)?.count)
        #expect(closed.backlog.isEmpty)
        #expect(counted == 0)
    }

    /// `Load more` belongs to the view the page is behind. In `All open` it would grow the list
    /// with rows that view cannot hold — the control-that-does-nothing, one worse (#900).
    @Test(arguments: [TicketsView.allOpen, .unblocked, .inProgress, .blocked])
    func `no open view offers to load more closed tickets`(_ view: TicketsView) {
        #expect(!room(TicketsFixture.closedMore, in: view).opened.closedHasMore)
    }

    // MARK: - The chrome

    /// A heading reading `by priority` over a list ordered by recency is the exact lie the second
    /// line exists to prevent.
    @Test
    func `the heading names the order in force, not a grouping there is none of`() {
        let reading = TicketsChromeProjection.reading(of: room(), in: .closed, showing: nil)

        #expect(reading.subtitle.contains("by last touched"))
        #expect(!reading.subtitle.contains("by priority"))
        #expect(reading.structure.groups == false)
    }

    @Test
    func `the open views still group by priority`() {
        let open = room(in: .allOpen)
        let reading = TicketsChromeProjection.reading(of: open, in: .allOpen, showing: nil)

        #expect(reading.subtitle.contains("by priority"))
        #expect(reading.structure.groups)
    }

    // MARK: - The search field reaches it

    /// "Was #895 ever resolved" is the question the field answers here, and typing the number is
    /// the shortest path to it.
    @Test
    func `the search field narrows the closed view too`() throws {
        let number = try #require(room().backlog.first?.id)

        let searched = room(TicketsFixture.closedRead, in: .closed, matching: "#\(number)")

        #expect(searched.narrowing?.matches == 1)
        #expect(drawn(searched).map(\.id) == [number])
    }

    // MARK: - The room's own nothings

    /// A Project where everything is finished must still be able to show the view that says so —
    /// an empty OPEN set is not `Closed`'s nothing.
    @Test
    func `a Project with nothing open still draws its closed rows`() {
        var reading = TicketsFixture.closedRead
        reading.items = reading.items.filter { $0.closure != .open }

        let closed = room(reading)
        #expect(closed.vacancy == nil)
        #expect(!closed.backlog.isEmpty)
        // …and the open views still say the open set is empty, which is the other half of it.
        #expect(room(reading, in: .allOpen).vacancy == .nothingOpen(provider: "GitHub"))
    }

    /// Before the read has answered the view has not been told anything, which is `unread` and not
    /// an empty backlog — the same distinction #818 drew for the poll.
    @Test
    func `the closed view is unread before its own read has landed`() {
        #expect(room(TicketsFixture.reading).vacancy == .unread(provider: "GitHub"))
    }

    /// "Everything is closed" and "nothing has ever been closed" are opposite facts about one
    /// Project, and the pages must not be able to say one for the other.
    @Test
    func `a provider with nothing closed says so in its own words`() {
        var reading = TicketsFixture.closedRead
        reading.items = reading.items.filter { $0.closure == .open }

        #expect(room(reading).vacancy == .nothingClosed(provider: "GitHub"))
    }

    // MARK: - The page behind this one

    @Test
    func `the Load more row stands only where the provider served a cursor`() {
        #expect(room(TicketsFixture.closedMore).opened.closedHasMore)
        #expect(!room(TicketsFixture.closedRead).opened.closedHasMore)
        #expect(!room(TicketsFixture.reading).opened.closedHasMore)
    }
}

import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// The fifth view — the only one not defined over the open set (#1075).
///
/// Two claims run through every case here. The `Closed` view shows what the other four cannot, and
/// it changes none of what they say: every reading defined over the open set is still defined over
/// the open set with a closed listing in hand.
@Suite("The Closed view")
struct TicketsClosedViewTests {
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

    /// These items, with the closed read having answered with every closed one of them — the state
    /// a room reaches only after the reader has opened the view.
    private static func listed(_ items: [Ticket]) -> TicketsReading {
        var reading = TicketsFixture.reading(of: items)
        reading.closedListing = TicketsReading.ClosedListingReading(
            numbers: Set(items.filter { $0.closure != .open }.map(\.number)),
            hasMore: false,
        )
        return reading
    }

    // MARK: - What it lists

    @Test
    func `the Closed view lists the closed tickets and nothing else`() {
        let closed = room()

        #expect(!closed.backlog.isEmpty)
        #expect(closed.backlog.allSatisfy { $0.closure != nil })
    }

    /// The four open views cannot reach a closed ticket, which is the whole shape of the problem
    /// this ticket names: they are filters WITHIN the open set.
    @Test(arguments: [TicketsView.allOpen, .unblocked, .inProgress, .blocked])
    func `no open view can reach a closed ticket`(_ view: TicketsView) {
        let open = room(in: view)

        #expect(open.backlog.allSatisfy { $0.closure == nil })
    }

    /// Last touched first, which is the order the second line under the heading names — and the
    /// order both adapters ask the provider for, so the page boundary and the row order agree.
    @Test
    func `the closed list is ordered by last touched, newest first`() {
        let rows = room().backlog

        let stamps = rows.compactMap(\.touched)
        #expect(stamps.count == rows.count)
        #expect(stamps == stamps.sorted(by: >))
    }

    /// A row the provider served no date for cannot claim a recency nobody established, so it sinks
    /// rather than sorting as though it were touched at the epoch's convenience.
    @Test
    func `a closed row with no date sinks below every dated one`() {
        let reading = Self.listed([
            Ticket(number: 900, title: "Undated", status: "Done", closure: .resolved),
            Ticket(
                number: 100, title: "Dated", status: "Done", closure: .resolved,
                updatedAt: TicketsFixture.asOf,
            ),
        ])

        #expect(room(reading).backlog.map(\.id) == [100, 900])
    }

    // MARK: - The two closed buckets stay apart

    @Test
    func `resolved and ruled out each render as themselves`() {
        let words = Set(room().backlog.compactMap(\.closure).map(ClosureMark.word))

        #expect(words.contains("resolved"))
        #expect(words.contains("ruled out"))
    }

    /// `TicketState` folds `closedUnreadably` into `resolved` because a bucket has to choose. The
    /// row does not have to, and must not: claiming the work was done over a port that could not
    /// read which closure this was is a false DIRECT (`CONTEXT.md` L2 · degrade-down).
    @Test
    func `a closure nobody could read says closed, never resolved`() {
        #expect(ClosureMark.word(of: .closedUnreadably) == "closed")
        #expect(ClosureMark.word(of: .resolved) == "resolved")
        #expect(ClosureMark.word(of: .ruledOut) == "ruled out")
    }

    // MARK: - The closed set enters no other reading

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

    // MARK: - The chrome

    /// A heading reading `by priority` over a list ordered by recency is the exact lie the second
    /// line exists to prevent.
    @Test
    func `the heading names the order in force, not a grouping there is none of`() {
        let reading = TicketsChromeProjection.reading(of: room(), in: .closed, showing: nil)

        #expect(reading.subtitle.contains("by last touched"))
        #expect(!reading.subtitle.contains("by priority"))
        #expect(reading.groups == false)
    }

    @Test
    func `the open views still group by priority`() {
        let open = room(in: .allOpen)
        let reading = TicketsChromeProjection.reading(of: open, in: .allOpen, showing: nil)

        #expect(reading.subtitle.contains("by priority"))
        #expect(reading.groups)
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
        #expect(room(TicketsFixture.closedMore).closedHasMore)
        #expect(!room(TicketsFixture.closedRead).closedHasMore)
        #expect(!room(TicketsFixture.reading).closedHasMore)
    }
}

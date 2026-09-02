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
@MainActor
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
        #expect(closed.backlog.allSatisfy { $0.marks.closure != nil })
    }

    /// The four open views cannot reach a closed ticket, which is the whole shape of the problem
    /// this ticket names: they are filters WITHIN the open set.
    @Test(arguments: [TicketsView.allOpen, .unblocked, .inProgress, .blocked])
    func `no open view can reach a closed ticket`(_ view: TicketsView) {
        let open = room(in: view)

        #expect(open.backlog.allSatisfy { $0.marks.closure == nil })
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
        let words = Set(room().backlog.compactMap(\.marks.closure).map(ClosureMark.word))

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
}

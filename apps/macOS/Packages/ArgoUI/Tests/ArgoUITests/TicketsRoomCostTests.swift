import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// What SELECTING a ticket costs (ADR-0028 Rule 1 and Rule 3).
///
/// `navigation.ticket` is one `Int?`, and changing it invalidated `CockpitView.body`, which
/// reassembled the whole room: two filters over every item, five more over the open set, a tree
/// build with a sibling sort per node, and the hero's ranking. The selected number is an input to
/// none of that — only to which detail the pane draws — so a click was paying for the backlog.
///
/// COUNTS of Tickets, never seconds (ADR-0028 Rule 8). A count reads the same idle and loaded,
/// which is the whole reason the claim can be made on a laptop with five other agents on it, and
/// the two arms are the same work at two sizes so the ratio's halves are alike by construction.
///
/// The stamp holds the reading BY VALUE, so a hit over a listing handed in as a fresh array is a
/// comparison of every ticket — and the memo charges the tally for exactly that, which is why the
/// gate can see it. What no count here sees is the OTHER collections in the stamp: `TicketsReading
/// .live` rebuilds `closedListing`'s number Set on every pass (#1075), so a stamp comparison walks
/// it whatever the listing does. That is upstream of this memo and named rather than charged.
@Suite("Tickets room cost", .serialized)
@MainActor
struct TicketsRoomCostTests {
    /// Rule 3, and the user's complaint: highlighting a ticket in a backlog of 2 000 costs what it
    /// costs in a backlog of 200.
    @Test
    func `selecting a ticket costs no more over a listing ten times the size`() {
        let small = Self.selecting(over: Self.small)
        let large = Self.selecting(over: Self.large)

        #expect(small > 0)
        #expect(Double(large) / Double(small) <= PerfBudgets.ticketSelectionFlat)
    }

    /// The same claim without the division, because the count is EXACT: the same ticket opened out
    /// of two listings costs the same looks, and a listing ten times the size adds none of them.
    @Test
    func `the same ticket opened out of either listing reads the same tickets`() {
        #expect(Self.selecting(over: Self.small) == Self.selecting(over: Self.large))
    }

    /// The tally is shown to MOVE, so a counter that had stopped counting cannot leave the gate
    /// green at a blind zero (ADR-0028, #1070). A cold room walks its whole listing exactly once.
    @Test
    func `a cold room is charged the listing it walked`() {
        TicketsRoomMemo.forget()
        TicketsRoomTally.forget()

        _ = TicketsRoomProjection.room(from: Self.listing(of: Self.small))

        #expect(TicketsRoomTally.counts.derivations.times == 1)
        #expect(TicketsRoomTally.counts.derivations.tickets == Self.small)
    }

    /// The hero's `PRD sequence` key, which asked every chart's children for every ranked item —
    /// `O(pool × items)`. Per TICKET rather than in total, because the index's own pass is linear
    /// in the listing and is meant to be: what may not grow is the cost of one ticket.
    @Test
    func `placing the hero's pool does not cost more per ticket as the listing grows`() {
        let small = Double(Self.warmed(over: Self.small).cold.places) / Double(Self.small)
        let large = Double(Self.warmed(over: Self.large).cold.places) / Double(Self.large)

        #expect(small > 0)
        #expect(large / small <= PerfBudgets.ticketPlacementFlat)
    }

    /// The memo may not hold a room over a listing that has moved. Same COUNT of tickets, one of
    /// them retitled: a stamp made of a count would serve the room before the edit.
    @Test
    func `a retitled ticket is a different room`() {
        TicketsRoomMemo.forget()
        let before = TicketsRoomProjection.room(from: Self.listing(of: Self.small))
        let after = TicketsRoomProjection.room(from: Self.listing(of: Self.small, retitling: 11))

        #expect(before.backlog != after.backlog)
        #expect(after.backlog.contains { $0.title == "renamed" })
    }

    /// The half that matters more than the saving: a remembered room may never draw a remembered
    /// ticket. Three selections against ONE memo entry, each answering for itself.
    @Test
    func `each selection draws its own ticket off the one remembered room`() {
        TicketsRoomMemo.forget()
        let reading = Self.listing(of: Self.small)
        let backlog = TicketsRoomProjection.room(from: reading).backlog

        let opened = [4, 7, nil].map { TicketsRoomProjection.room(from: reading.opened(at: $0)) }

        #expect(opened.map { $0.ticket?.id } == [4, 7, nil])
        #expect(opened.allSatisfy { $0.backlog == backlog })
        #expect(opened[0].ticket?.title == "ticket 4")
    }

    /// A number the listing does not hold is the unread page and not a stale detail (#895) — the
    /// one branch `opened(on:at:)` decides, held against a memo that carries neither field.
    @Test
    func `a number nothing was read for opens the unread page`() {
        TicketsRoomMemo.forget()
        let room = TicketsRoomProjection.room(from: Self.listing(of: Self.small).opened(at: 9999))

        #expect(room.ticket == nil)
        #expect(room.unreadNumber == 9999)
    }

    /// What the arms above assume, asserted rather than assumed: the app hands the same stored
    /// array on every pass, so the key is answered by the listing's storage and walks nothing.
    @Test
    func `the same listing is answered without reading a ticket`() {
        TicketsRoomMemo.forget()
        let reading = Self.listing(of: Self.small)

        _ = TicketsRoomProjection.room(from: reading)
        TicketsRoomTally.forget()
        _ = TicketsRoomProjection.room(from: reading.opened(at: 4))

        #expect(TicketsRoomTally.counts.derivations.times == 0)
        #expect(TicketsRoomTally.counts.compared == 0)
    }

    /// And the other half of that, which is what stops the assumption being a blind spot: a listing
    /// rebuilt into an EQUAL but separate array still hits, and the walk it costs is charged — so a
    /// caller that started handing fresh arrays reddens the ratio above rather than passing
    /// quietly.
    @Test
    func `a listing rebuilt into a fresh array is charged the walk it costs`() {
        TicketsRoomMemo.forget()
        let reading = Self.listing(of: Self.small)

        _ = TicketsRoomProjection.room(from: reading)
        TicketsRoomTally.forget()
        let again = TicketsRoomProjection.room(from: Self.listing(of: Self.small).opened(at: 4))

        #expect(TicketsRoomTally.counts.derivations.times == 0)
        #expect(TicketsRoomTally.counts.compared == Self.small)
        #expect(again.ticket?.id == 4)
    }

    /// The two sizes Rule 3 names.
    private static let small = 200
    private static let large = 2000

    /// What one selection costs over a listing of this size: the room derived cold, then the click,
    /// charged on its own cleared tally.
    private static func selecting(over count: Int) -> Int {
        let reading = Self.warmed(over: count).reading
        TicketsRoomTally.forget()
        _ = TicketsRoomProjection.room(from: reading.opened(at: Self.selected))
        return TicketsRoomTally.counts.tickets
    }

    /// What the COLD pass over a listing of this size was charged, and the reading it was taken
    /// over. Leaves the memo holding that room and the tally holding the cold figures.
    private static func warmed(over count: Int) -> (reading: TicketsReading, cold: Counts) {
        TicketsRoomMemo.forget()
        TicketsRoomTally.forget()
        let reading = Self.listing(of: count)
        _ = TicketsRoomProjection.room(from: reading)
        return (reading, TicketsRoomTally.counts)
    }

    private typealias Counts = TicketsRoomTally.Counts

    /// The ticket both arms open. Its own shape — a leaf under a chart, with one resolved blocker
    /// — is what a selection is charged, and it is the same shape in both listings by construction.
    private static let selected = 4

    /// A listing of `count` tickets: every tenth a PRD-shaped chart holding the nine under it, so
    /// the hero has charts to sequence against and the tree has parents to sort.
    ///
    /// `retitling` renames one ticket without moving the count, which is the case a stamp made of a
    /// count could not tell from no change at all.
    private static func listing(of count: Int, retitling renamed: Int? = nil) -> TicketsReading {
        let items = (1 ... count).map { number in
            Self.ticket(number, of: count, named: number == renamed ? "renamed" : nil)
        }
        return TicketsReading(
            items: items,
            provider: TicketsProvider(
                name: "GitHub", account: "argo",
                connection: .init(state: .idle, hasAnswered: true),
            ),
        )
    }

    /// One ticket of that listing. Every tenth is the chart; `selected` carries the one blocker.
    private static func ticket(_ number: Int, of count: Int, named renamed: String?) -> Ticket {
        let isChart = (number - 1).isMultiple(of: 10) && number < count
        let children: [Int] = isChart ? Array((number + 1) ... min(number + 9, count)) : []
        let blockers: [TicketBlocker] =
            number == selected ? [TicketBlocker(number: 2, closure: .resolved)] : []
        return Ticket(
            number: number,
            title: renamed ?? "ticket \(number)",
            status: "Open",
            closure: .open,
            priority: number.isMultiple(of: 3) ? "high" : "medium",
            type: isChart ? "PRD" : "task",
            children: children,
            blockedBy: blockers,
            updatedAt: Date(timeIntervalSince1970: TimeInterval(number)),
        )
    }
}

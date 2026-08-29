import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// What a backlog row's trailing region says, and what it deliberately does not (#896, #897).
///
/// The region holds two marks and the precedence between them is settled in ONE place
/// (`cockpit-work-room.md` — the trailing region): the blockage mark is a state and does not
/// contend, and the caption holds exactly one fact.
@Suite("The backlog row's trailing region")
struct TicketsBacklogMarkTests {
    private static func item(_ number: Int, blockedBy: [TicketBlocker]?) -> Ticket {
        Ticket(
            number: number, title: "A ticket behind an edge", status: "Todo", closure: .open,
            blockedBy: blockedBy,
        )
    }

    @Test
    func `a ticket waiting on open blockers marks how many`() {
        let blockers = [
            TicketBlocker(number: 2, closure: .open),
            TicketBlocker(number: 3, closure: .open),
            TicketBlocker(number: 4, closure: .resolved),
        ]

        let mark = TicketsRoomProjection.blockage(of: Self.item(1, blockedBy: blockers))

        #expect(mark == TicketsRoomProjection.Blockage(count: 2, isStranded: false))
    }

    @Test
    func `a ticket the provider said is clear marks nothing`() {
        #expect(TicketsRoomProjection.blockage(of: Self.item(1, blockedBy: [])) == nil)
    }

    /// The mark and its absence are not the same claim. Nothing is drawn either way, which is the
    /// point: the row does not say `unblocked` over edges nobody served
    /// (`CONTEXT.md` L2 · degrade-down).
    @Test
    func `a ticket whose edges nobody served marks nothing and claims nothing`() {
        #expect(TicketsRoomProjection.blockage(of: Self.item(1, blockedBy: nil)) == nil)
    }

    /// A ruled-out blocker never satisfies, so the edge can only be cleared by a human re-scoping
    /// one of the two. The mark says so in its own ink rather than reading as a wait that ends.
    @Test
    func `a stranded ticket marks the same count and says it is stranded`() {
        let blockers = [
            TicketBlocker(number: 2, closure: .ruledOut),
            TicketBlocker(number: 3, closure: .open),
        ]

        let mark = TicketsRoomProjection.blockage(of: Self.item(1, blockedBy: blockers))

        #expect(mark == TicketsRoomProjection.Blockage(count: 2, isStranded: true))
    }

    /// The mark and the sidebar's `Blocked` count are two shapes of one engine fact, and #896 asks
    /// for them to agree. They are different code — this counts what still stands, `admits` asks
    /// which side of the partition a ticket falls — so the agreement is CHECKED over the whole open
    /// set rather than asserted in a comment. A row carrying a mark is exactly a row `Blocked`
    /// holds, and neither view holds a ticket whose edges nobody served.
    @Test
    func `a row carries a mark exactly where the sidebar counts it blocked`() {
        let open = TicketsFixture.items.filter { $0.closure == .open }

        for item in open {
            let marked = TicketsRoomProjection.blockage(of: item) != nil
            #expect(marked == TicketsView.blocked.admits(item, claimed: false))
            #expect(marked != TicketsView.unblocked.admits(item, claimed: false))
        }
    }

    /// One concept, one mark. The row's mark and the sidebar's `Blocked` view name the same
    /// glyph independently, so this is what stops a later edit moving one of them alone (#939).
    @Test
    func `the row's mark and the sidebar's Blocked view draw one glyph`() {
        #expect(BlockageMark.symbol == TicketsView.blocked.symbol)
    }

    /// …and the third state is in NEITHER, which is what keeps the two views a partition of the
    /// tickets whose edges were read rather than of every ticket.
    @Test
    func `a ticket whose edges nobody served is in neither view and carries no mark`() {
        let unedged = Self.item(1, blockedBy: nil)

        #expect(TicketsRoomProjection.blockage(of: unedged) == nil)
        #expect(!TicketsView.blocked.admits(unedged, claimed: false))
        #expect(!TicketsView.unblocked.admits(unedged, claimed: false))
    }

    @Test
    func `the mark reaches the row the list draws`() {
        let room = TicketsRoomProjection.room(from: TicketsFixture.reading)

        // #272 waits on #609 and #388, both open; #763 was served an empty edge list.
        #expect(room.backlog.first { $0.id == 763 }?.blockage == nil)
        #expect(
            room.backlog.first { $0.id == 607 }?.children.first { $0.id == 272 }?.blockage
                == TicketsRoomProjection.Blockage(count: 2, isStranded: false),
        )
    }
}

/// Which ONE fact the caption slot carries. The four candidates are ordered here and nowhere else,
/// so a fifth has to be placed in this list rather than race the others for the slot.
@Suite("The backlog row's caption")
struct TicketsBacklogCaptionTests {
    private static let now = Date(timeIntervalSince1970: 1_700_000_000)

    private static func drawn(
        trailing: String? = nil,
        odd: String? = nil,
        daysAgo: Double? = nil,
    )
        -> TicketsRoomProjection.Drawn {
        let row = TicketsRoomProjection.Row(
            id: 1, title: "A ticket", delivery: .absent, trailing: trailing, priority: nil,
            labels: [], children: [], blockage: nil,
            touched: daysAgo.map { now.addingTimeInterval(-$0 * 86400) },
        )
        var drawn = TicketsRoomProjection.Drawn(row: row, depth: 0)
        drawn.odd = odd
        return drawn
    }

    @Test
    func `a parent roll-up outranks the odd priority and the age`() {
        let drawn = Self.drawn(trailing: "2/9", odd: "medium", daysAgo: 12)

        #expect(drawn.caption(asOf: Self.now) == "2/9")
    }

    @Test
    func `an odd priority outranks the age`() {
        #expect(Self.drawn(odd: "medium", daysAgo: 12).caption(asOf: Self.now) == "medium")
    }

    /// The age is the slot's DEFAULT — what it says when nothing more specific has claimed it.
    /// Last, because nearly every row has one: an age that outranked the other two would delete
    /// them from a list where they are the only thing saying it.
    @Test
    func `the age takes the slot nothing else claimed`() {
        #expect(Self.drawn(daysAgo: 12).caption(asOf: Self.now) == "1w")
    }

    @Test
    func `a row whose provider served no date carries no caption at all`() {
        #expect(Self.drawn().caption(asOf: Self.now) == nil)
    }

    /// The two marks answer different questions — "can I start this" and "how long has it sat" —
    /// so a row that is both blocked and stale draws both rather than choosing.
    @Test
    func `the blockage mark does not contend for the caption`() {
        let room = TicketsRoomProjection.room(from: TicketsFixture.reading)
        let drawn = TicketsRoomProjection.drawn(room.backlog, shut: [])
        let stale = drawn.first { $0.id == 272 }

        #expect(stale?.row.blockage?.count == 2)
        #expect(stale?.caption(asOf: Self.now) != nil)
    }
}

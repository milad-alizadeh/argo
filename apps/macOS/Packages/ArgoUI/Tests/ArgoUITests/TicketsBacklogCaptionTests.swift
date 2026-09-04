import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import Foundation
import Testing

/// Which ONE fact the caption slot carries. The four candidates are ordered here and nowhere else,
/// so a fifth has to be placed in this list rather than race the others for the slot.
@Suite("The backlog row's caption")
@MainActor
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
            labels: [], children: [], marks: .none,
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

        #expect(stale?.row.marks.blockage?.count == 2)
        #expect(stale?.caption(asOf: Self.now) != nil)
    }
}

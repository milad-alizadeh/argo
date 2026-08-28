import ArgoEngine
@testable import ArgoUI
import Testing

/// What the Tickets room reads off a set of Tickets (#812). The four sidebar views are arithmetic
/// over the same list the deck draws, so a count that disagrees with the rows under it is the one
/// defect a render cannot show.
@Suite("Tickets room projection")
struct TicketsRoomProjectionTests {
    /// Drawn, not rooted: the backlog nests (#814), so what the list puts on screen is the tree
    /// flattened rather than the roots alone.
    @Test
    func `the backlog draws every open item and no closed one`() {
        let room = TicketsRoomProjection.room(from: TicketsFixture.reading)

        #expect(drawnIds(room)
            == [607, 609, 388, 272, 273, 334, 335, 336, 763, 275, 160, 185])
    }

    @Test
    func `all open counts the rows the list draws`() {
        let room = TicketsRoomProjection.room(from: TicketsFixture.reading)

        #expect(room.view(.allOpen)?.count == drawnIds(room).count)
    }

    /// Unblocked and Blocked partition the open set: an item is one or the other, never both and
    /// never neither, or a reader filtering both ways would lose work.
    @Test
    func `unblocked and blocked partition the open items`() {
        let room = TicketsRoomProjection.room(from: TicketsFixture.reading)

        let unblocked = room.view(.unblocked)?.count ?? 0
        let blocked = room.view(.blocked)?.count ?? 0
        #expect(unblocked + blocked == drawnIds(room).count)
    }

    /// Stranded is blocked, not clear: its blocker was ruled out, so the edge never satisfies.
    @Test
    func `a stranded item counts as blocked`() {
        let stranded = TicketsFixture.item(272, blockedBy: [.init(number: 9, closure: .ruledOut)])
        let room = TicketsRoomProjection.room(from: TicketsFixture.reading(of: [stranded]))

        #expect(room.view(.blocked)?.count == 1)
        #expect(room.view(.unblocked)?.count == .zero)
    }

    @Test
    func `in progress counts the items a Session has claimed`() {
        let room = TicketsRoomProjection.room(from: TicketsFixture.reading)

        #expect(room.view(.inProgress)?.count == 3)
    }

    /// A closed blocker satisfies its edge, so an item behind one is unblocked rather than blocked
    /// by the count the provider's own summary would give.
    @Test
    func `a resolved blocker leaves its dependent unblocked`() {
        let freed = TicketsFixture.item(272, blockedBy: [.init(number: 9, closure: .resolved)])
        let room = TicketsRoomProjection.room(from: TicketsFixture.reading(of: [freed]))

        #expect(room.view(.unblocked)?.count == 1)
    }

    /// The roll-up counts the tracker's children, not the rows beside it — a parent whose closed
    /// children were never read still says how many it has.
    @Test
    func `a parent's trailing fact rolls its children up`() {
        let room = TicketsRoomProjection.room(from: TicketsFixture.reading)

        #expect(room.backlog.first { $0.id == 607 }?.trailing == "2/9")
    }

    @Test
    func `a leaf carries no trailing fact`() {
        let room = TicketsRoomProjection.room(from: TicketsFixture.reading)

        #expect(room.backlog.first { $0.id == 273 }?.trailing == nil)
    }

    /// The dot is the room's whole Delivery signal, so an item nothing was read for reads `none`
    /// rather than borrowing the quiet end of the vocabulary.
    @Test
    func `an item with no Delivery read draws the empty dot`() {
        let room = TicketsRoomProjection.room(from: TicketsFixture.reading)

        #expect(room.backlog.first { $0.id == 160 }?.delivery == .absent)
    }

    @Test
    func `the ticket keeps the provider's status word and files it under Argo's bucket`() {
        let room = TicketsRoomProjection.room(from: TicketsFixture.reading)

        #expect(room.ticket?.status == "Todo")
        #expect(room.ticket?.bucket == .open)
    }

    /// Argo's bucket outranks nothing: a claimed ticket is `claimed`, and the provider's word for
    /// it is still whatever the provider says.
    @Test
    func `a claimed ticket files under claimed and keeps its own word`() {
        let room = TicketsRoomProjection.room(from: TicketsFixture.reading(showing: 388))

        #expect(room.ticket?.status == "In progress")
        #expect(room.ticket?.bucket == .claimed)
    }

    /// The view is what the deck DRAWS, not just a number in the rail: opening one filters the
    /// backlog to it. Before this the selection was written and never read, so every view drew the
    /// same twelve rows.
    @Test
    func `opening a view filters the backlog to it`() {
        let blocked = TicketsRoomProjection.room(from: TicketsFixture.reading, in: .blocked)

        #expect(drawnIds(blocked).count == 8)
        #expect(drawnIds(blocked)
            == [607, 272, 334, 335, 336, 275, 160, 185])
    }

    @Test
    func `in progress draws only the tickets a Session holds`() {
        let running = TicketsRoomProjection.room(from: TicketsFixture.reading, in: .inProgress)

        #expect(running.backlog.map(\.id) == [609, 388, 763])
    }

    /// Each view's own count is what it draws, or the rail is telling the reader a number the pane
    /// beside it disagrees with.
    @Test
    func `every view's count is the number of rows it draws`() {
        for view in TicketsView.allCases {
            let room = TicketsRoomProjection.room(from: TicketsFixture.reading, in: view)
            #expect(room.view(view)?.count == drawnIds(room).count)
        }
    }

    /// The counts are over the WHOLE open set, whichever view is open — a rail that recounted
    /// itself against its own filter would read `Blocked 8` and every other view zero.
    @Test
    func `the counts do not move when a view is opened`() {
        let atRest = TicketsRoomProjection.room(from: TicketsFixture.reading, in: .allOpen)
        let filtered = TicketsRoomProjection.room(from: TicketsFixture.reading, in: .blocked)

        #expect(atRest.views == filtered.views)
    }

    /// With nothing bound the room hides WHOLE (#272): no provider, and no views either. Four
    /// views reading zero would say the backlog is clear, which nobody has the standing to claim
    /// when nobody was asked.
    @Test
    func `an unbound room is vacant rather than empty`() {
        let room = TicketsRoomProjection.room(from: TicketsFixture.unbound)

        #expect(room.provider == nil)
        #expect(room.views.isEmpty)
        #expect(room.backlog.isEmpty)
    }

    /// The other empty page: the provider answered, and the answer was nothing. Its views stay, all
    /// reading zero — telling a reader their backlog is empty is only honest once somebody asked.
    @Test
    func `a provider that answered with nothing keeps its views`() {
        let room = TicketsRoomProjection.room(from: TicketsFixture.answeredEmpty)

        #expect(room.provider != nil)
        #expect(room.views.map(\.count) == [0, 0, 0, 0])
        #expect(room.backlog.isEmpty)
    }

    /// What the list actually PUTS ON SCREEN with nothing folded — the tree flattened. A view's
    /// count is measured against this rather than `backlog.count`, which counts roots alone.
    private func drawnIds(_ room: TicketsRoomProjection.Room) -> [Int] {
        TicketsRoomProjection.drawn(room.backlog, shut: []).map(\.id)
    }
}

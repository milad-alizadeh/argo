import ArgoEngine
@testable import ArgoUI
import Testing

/// What the ticket detail reads off a Ticket (#815) — the fact strip, the Deliveries, and the
/// two link sections. Every claim here is about what Argo is entitled to SAY: a fact nobody read is
/// absent, and an absence is never dressed up as an answer.
@Suite("The ticket's facts and its sections")
struct TicketProjectionTests {
    // MARK: - The fact strip

    @Test
    func `the labels are the provider's own, verbatim and complete`() {
        let ticket = WorkFixture.room.ticket

        // `blocked` is one of them, and stays: a list that drops the members Argo restates
        // elsewhere is no longer the provider's list.
        #expect(ticket?.labels.map(\.name) == ["work-room", "ui", "blocked"])
    }

    @Test
    func `the provider's priority and type words are kept as it spells them`() {
        let ticket = WorkFixture.room(showing: 607).ticket

        #expect(ticket?.priority == "high")
        #expect(ticket?.type == "PRD")
    }

    /// The strip's floor. Argo's own bucket is the one fact that survives a provider saying
    /// nothing, because Argo computes it rather than reading it.
    @Test
    func `a ticket nothing was read about carries no priority, type or labels`() {
        let ticket = WorkRoomProjection.room(from: WorkFixture.unread).ticket

        #expect(ticket?.priority == nil)
        #expect(ticket?.type == nil)
        #expect(ticket?.labels.isEmpty == true)
        #expect(ticket?.bucket == .open)
    }

    // MARK: - Deliveries

    @Test
    func `two Deliveries on one ticket are two chips`() {
        let ticket = WorkFixture.room(showing: 607).ticket

        #expect(ticket?.deliveries.map(\.name) == ["argo#812", "argo#829"])
        #expect(ticket?.deliveries.first?.checks == .passing)
        #expect(ticket?.deliveries.last?.checks == .failing)
    }

    @Test
    func `one Delivery is one chip`() {
        #expect(WorkFixture.room(showing: 763).ticket?.deliveries.count == 1)
    }

    @Test
    func `a ticket with nothing in flight carries no chip`() {
        #expect(WorkFixture.room.ticket?.deliveries.isEmpty == true)
    }

    // MARK: - Blocked by

    @Test
    func `six blockers are six links, in the provider's own edge order`() {
        let ticket = WorkFixture.room(showing: 607).ticket

        #expect(ticket?.blockedBy.map(\.id) == [609, 388, 264, 256, 375, 376])
    }

    /// A closed blocker is not in the backlog, so nothing beside the list names it. The tracker
    /// still does, and the row renders the tracker's name rather than a stand-in a reader could not
    /// tell from a real title.
    @Test
    func `a blocker that is already closed still renders the tracker's name for it`() {
        let closedBlocker = WorkFixture.room(showing: 607).ticket?.blockedBy.first { $0.id == 264 }

        #expect(closedBlocker?.title == "App shell: project strip, top bar, room tabs")
    }

    /// The other half of the same rule: where the poll reached nothing, the row says its number and
    /// stops. A placeholder here would read as the ticket's actual title.
    @Test
    func `a blocker the poll never reached is named by its number alone`() {
        let unread = WorkFixture.item(272, blockedBy: [.init(number: 9001, closure: .open)])
        let room = WorkRoomProjection.room(
            from: WorkFixture.reading(of: [unread]).opened(at: 272),
        )

        #expect(room.ticket?.blockedBy.map(\.id) == [9001])
        #expect(room.ticket?.blockedBy.first?.title == nil)
    }

    /// With no dependency edges the section is ABSENT, not empty. A provider that exposes no
    /// dependency information has not told us there are no blockers, and an empty list is the only
    /// thing Argo can see either way — so it resolves to the quieter reading.
    @Test
    func `a provider with no dependency edges leaves the section absent`() {
        let room = WorkRoomProjection.room(from: WorkFixture.edgeless)

        #expect(room.ticket?.blockedBy.isEmpty == true)
    }

    /// A blocker carries no Delivery mark: nothing reads a Delivery for a ticket that is not in the
    /// backlog, and `absent` is the reading that says so rather than the quiet end of the five.
    @Test
    func `every blocker takes the absent mark`() {
        let ticket = WorkFixture.room(showing: 607).ticket

        #expect(ticket?.blockedBy.allSatisfy { $0.delivery == .absent } == true)
    }

    // MARK: - Children

    @Test
    func `a parent lists its open children in its own order, with the provider's word`() {
        let children = WorkFixture.room(showing: 607).ticket?.children

        #expect(children?.open.map(\.id) == [609, 388, 272, 273, 334])
        #expect(children?.open.first?.trailing == "In progress")
    }

    /// The figure is the TRACKER's and counts children the section does not draw, which is why
    /// `2 of 9 closed` stands over five rows and is right.
    @Test
    func `the children figure counts the tracker's children, not the rows`() {
        let children = WorkFixture.room(showing: 607).ticket?.children

        #expect(children?.closed == 2)
        #expect(children?.total == 9)
        #expect(children?.open.count == 5)
    }

    /// A child carries its own mark — unlike a blocker, it is in the backlog beside this pane.
    @Test
    func `a child carries the Delivery mark the backlog gives it`() {
        let children = WorkFixture.room(showing: 607).ticket?.children

        #expect(children?.open.first { $0.id == 609 }?.delivery == .merged)
    }

    @Test
    func `a leaf has no Children section at all`() {
        #expect(WorkFixture.room.ticket?.children == nil)
    }

    /// A parent whose children are ALL closed keeps the section: the figure is the news there, and
    /// the sentence under it says what the empty list means.
    @Test
    func `a parent with every child closed keeps its section and its figure`() {
        let parent = Ticket(
            number: 1, title: "Done all through", status: "Todo", closure: .open,
            children: [690, 745],
        )
        let items = [parent] + WorkFixture.items.filter { [690, 745].contains($0.number) }
        let room = WorkRoomProjection.room(from: WorkFixture.reading(of: items).opened(at: 1))

        #expect(room.ticket?.children?.open.isEmpty == true)
        #expect(room.ticket?.children?.closed == 2)
        #expect(room.ticket?.children?.total == 2)
    }
}

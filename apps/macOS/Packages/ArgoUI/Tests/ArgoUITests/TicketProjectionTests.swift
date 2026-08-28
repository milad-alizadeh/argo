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
        let ticket = TicketsFixture.room.ticket

        // `blocked` is one of them, and stays: a list that drops the members Argo restates
        // elsewhere is no longer the provider's list.
        #expect(ticket?.labels.map(\.name) == ["work-room", "ui", "blocked"])
    }

    @Test
    func `the provider's priority and type words are kept as it spells them`() {
        let ticket = TicketsFixture.room(showing: 607).ticket

        #expect(ticket?.priority == "high")
        #expect(ticket?.type == "PRD")
    }

    /// The strip's floor. Argo's own bucket is the one fact that survives a provider saying
    /// nothing, because Argo computes it rather than reading it.
    @Test
    func `a ticket nothing was read about carries no priority, type or labels`() {
        let ticket = TicketsRoomProjection.room(from: TicketsFixture.unread).ticket

        #expect(ticket?.priority == nil)
        #expect(ticket?.type == nil)
        #expect(ticket?.labels.isEmpty == true)
        #expect(ticket?.bucket == .open)
    }

    // MARK: - Deliveries

    @Test
    func `two Deliveries on one ticket are two chips`() {
        let ticket = TicketsFixture.room(showing: 607).ticket

        #expect(ticket?.deliveries.map(\.name) == ["argo#812", "argo#829"])
        #expect(ticket?.deliveries.first?.checks == .passing)
        #expect(ticket?.deliveries.last?.checks == .failing)
    }

    @Test
    func `one Delivery is one chip`() {
        #expect(TicketsFixture.room(showing: 763).ticket?.deliveries.count == 1)
    }

    @Test
    func `a ticket with nothing in flight carries no chip`() {
        #expect(TicketsFixture.room.ticket?.deliveries.isEmpty == true)
    }

    // MARK: - Blocked by

    @Test
    func `six blockers are six links, in the provider's own edge order`() {
        let ticket = TicketsFixture.room(showing: 607).ticket

        #expect(ticket?.blockedBy.map(\.id) == [609, 388, 264, 256, 375, 376])
    }

    /// A closed blocker is not in the backlog, so nothing beside the list names it. The tracker
    /// still does, and the row renders the tracker's name rather than a stand-in a reader could not
    /// tell from a real title.
    @Test
    func `a blocker that is already closed still renders the tracker's name for it`() {
        let closedBlocker = TicketsFixture.room(showing: 607).ticket?.blockedBy
            .first { $0.id == 264 }

        #expect(closedBlocker?.title == "App shell: project strip, top bar, room tabs")
    }

    /// The other half of the same rule: where the poll reached nothing, the row says its number and
    /// stops. A placeholder here would read as the ticket's actual title.
    @Test
    func `a blocker the poll never reached is named by its number alone`() {
        let unread = TicketsFixture.item(272, blockedBy: [.init(number: 9001, closure: .open)])
        let room = TicketsRoomProjection.room(
            from: TicketsFixture.reading(of: [unread]).opened(at: 272),
        )

        #expect(room.ticket?.blockedBy.map(\.id) == [9001])
        #expect(room.ticket?.blockedBy.first?.title == nil)
    }

    /// With no dependency edges the section is ABSENT, not empty. A provider that exposes no
    /// dependency information has not told us there are no blockers, and an empty list is the only
    /// thing Argo can see either way — so it resolves to the quieter reading.
    @Test
    func `a provider with no dependency edges leaves the section absent`() {
        let room = TicketsRoomProjection.room(from: TicketsFixture.edgeless)

        #expect(room.ticket?.blockedBy.isEmpty == true)
    }

    /// A blocker carries no Delivery mark: nothing reads a Delivery for a ticket that is not in the
    /// backlog, and `absent` is the reading that says so rather than the quiet end of the five.
    @Test
    func `every blocker takes the absent mark`() {
        let ticket = TicketsFixture.room(showing: 607).ticket

        #expect(ticket?.blockedBy.allSatisfy { $0.delivery == .absent } == true)
    }

    // MARK: - Children

    @Test
    func `a parent lists its open children in its own order, with the provider's word`() {
        let children = TicketsFixture.room(showing: 607).ticket?.children

        #expect(children?.open.map(\.id) == [609, 388, 272, 273, 334])
        #expect(children?.open.first?.trailing == "In progress")
    }

    /// The figure is the TRACKER's and counts children the section does not draw, which is why
    /// `2 of 9 closed` stands over five rows and is right.
    @Test
    func `the children figure counts the tracker's children, not the rows`() {
        let children = TicketsFixture.room(showing: 607).ticket?.children

        #expect(children?.closed == 2)
        #expect(children?.total == 9)
        #expect(children?.open.count == 5)
    }

    /// A child carries its own mark — unlike a blocker, it is in the backlog beside this pane.
    @Test
    func `a child carries the Delivery mark the backlog gives it`() {
        let children = TicketsFixture.room(showing: 607).ticket?.children

        #expect(children?.open.first { $0.id == 609 }?.delivery == .merged)
    }

    @Test
    func `a leaf has no Children section at all`() {
        #expect(TicketsFixture.room.ticket?.children == nil)
    }

    // MARK: - Reached by a link, not by the listing

    /// A closed ticket is in no listing and no sidebar view, so the only way to it is a link. Once
    /// it is in `items` the pane reads it as what it is, and never as open (#895).
    @Test
    func `a closed ticket reached by link opens as closed`() {
        let ticket = TicketsFixture.room(showing: 264).ticket

        #expect(ticket?.id == 264)
        #expect(ticket?.bucket == .resolved)
    }

    /// AC4's half that stands: the four views count the OPEN set, so a closed ticket arriving by
    /// link moves none of them. What it does move is the roll-up, which counts the closed set.
    @Test
    func `a closed ticket reached by link moves no sidebar count`() {
        let open = TicketsFixture.items.filter { $0.closure == .open }
        let without = TicketsRoomProjection.room(from: TicketsFixture.reading(of: open))

        let with = TicketsRoomProjection.room(
            from: TicketsFixture.reading(of: open + [Self.closed264]),
        )

        #expect(with.views == without.views)
    }

    /// The bug this ticket is named for. A parent whose closed children are not in `items` rolls up
    /// `0/2`, because the roll-up counts them out of the closed set — which is empty for GitHub
    /// until something reads one. The closed child arriving is what moves the number.
    @Test
    func `a parent's roll-up counts only the closed children that have been read`() {
        let parent = Ticket(
            number: 1, title: "Done all through", status: "Todo", closure: .open,
            children: [264, 690],
        )
        let unread = TicketsRoomProjection.room(from: TicketsFixture.reading(of: [parent]))

        let read = TicketsRoomProjection.room(
            from: TicketsFixture.reading(of: [parent, Self.closed264]),
        )

        #expect(unread.backlog.first?.trailing == "0/2")
        #expect(read.backlog.first?.trailing == "1/2")
    }

    /// A number the reader followed that nothing has been read for. Neither a ticket nor an empty
    /// pane: the deck says so, and the read it names is what fills it.
    @Test
    func `a followed number nothing was read for is unread, not an empty pane`() {
        let room = TicketsRoomProjection.room(from: TicketsFixture.reading(showing: 9001))

        #expect(room.ticket == nil)
        #expect(room.unreadNumber == 9001)
    }

    /// The other side of it, so the pane cannot draw both: a ticket the reading holds is read.
    @Test
    func `a ticket the reading holds is not unread`() {
        #expect(TicketsFixture.room(showing: 264).unreadNumber == nil)
    }

    private static let closed264 = Ticket(
        number: 264, title: "App shell", status: "Closed", closure: .resolved,
    )

    /// A parent whose children are ALL closed keeps the section: the figure is the news there, and
    /// the sentence under it says what the empty list means.
    @Test
    func `a parent with every child closed keeps its section and its figure`() {
        let parent = Ticket(
            number: 1, title: "Done all through", status: "Todo", closure: .open,
            children: [690, 745],
        )
        let items = [parent] + TicketsFixture.items.filter { [690, 745].contains($0.number) }
        let room = TicketsRoomProjection.room(from: TicketsFixture.reading(of: items).opened(at: 1))

        #expect(room.ticket?.children?.open.isEmpty == true)
        #expect(room.ticket?.children?.closed == 2)
        #expect(room.ticket?.children?.total == 2)
    }
}

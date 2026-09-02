import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

/// What the backlog reads off the CHILD EDGE (#814). The tree is derived from `Ticket.children`
/// rather than written down nested, so a provider that reparents a ticket moves the row without
/// anybody editing a literal — and the two ways an edge can lie (a second parent, a cycle) resolve
/// by a rule of Argo's own rather than by the order the provider's array happened to come in.
@Suite("The backlog nests")
@MainActor
struct TicketsBacklogTreeTests {
    /// #607, by its number rather than by its place in the list.
    private static var parent: TicketsRoomProjection.Row? {
        TicketsRoomProjection.room(from: TicketsFixture.reading).backlog.first { $0.id == 607 }
    }

    /// #1 and #2 both claim #3, in that order.
    private static let contested = [
        Ticket(number: 1, title: "First", status: "Todo", closure: .open, children: [3]),
        Ticket(number: 2, title: "Second", status: "Todo", closure: .open, children: [3]),
        Ticket(number: 3, title: "Shared", status: "Todo", closure: .open),
    ]

    @Test
    func `a parent draws its open children under it`() {
        let room = TicketsRoomProjection.room(from: TicketsFixture.reading)

        #expect(room.backlog.map(\.id) == [763, 607, 275, 185, 160])
        #expect(Self.parent?.children.map(\.id) == [609, 388, 334, 273, 272])
    }

    /// The list draws what is OPEN; the edge names more than that. #607 carries nine children, two
    /// of them closed and two the poll never reached, and none of the four is a row.
    @Test
    func `a closed child is an edge the list does not draw`() {
        #expect(Self.parent?.children.map(\.id).contains(690) == false)
        #expect(Self.parent?.trailing == "2/9")
    }

    @Test
    func `a child of a child nests one step further`() {
        let route = Self.parent?.children.first { $0.id == 334 }
        #expect(route?.children.map(\.id) == [336, 335])
        #expect(route?.trailing == "0/2")
    }

    /// Flattened, the tree is every one of the twelve rows — nesting changes where a row is
    /// INSET, never which rows there are.
    @Test
    func `the drawn order is every open item, parents before their children`() {
        let room = TicketsRoomProjection.room(from: TicketsFixture.reading)

        let drawn = TicketsRoomProjection.drawn(room.backlog, shut: [])
        #expect(drawn.map(\.id) == [763, 607, 609, 388, 334, 336, 335, 273, 272, 275, 185, 160])
        #expect(drawn.map(\.depth) == [0, 0, 1, 1, 1, 2, 2, 1, 1, 0, 0, 0])
    }

    /// Folding hides the subtree whole, not one level of it.
    @Test
    func `a shut parent draws neither its children nor their children`() {
        let room = TicketsRoomProjection.room(from: TicketsFixture.reading)

        let drawn = TicketsRoomProjection.drawn(room.backlog, shut: [607])
        #expect(drawn.map(\.id) == [763, 607, 275, 185, 160])
    }

    /// A shut parent is still a parent: the twist has to stay, or nothing could open it again.
    @Test
    func `a shut parent keeps its twist and a leaf never grows one`() {
        let room = TicketsRoomProjection.room(from: TicketsFixture.reading)

        let drawn = TicketsRoomProjection.drawn(room.backlog, shut: [607])
        #expect(drawn.first { $0.id == 607 }?.isParent == true)
        #expect(drawn.last?.isParent == false)
    }

    /// Two parents claiming one child would draw that child twice, and a reader counting rows would
    /// count it twice. The lower-numbered parent wins and the other claim is dropped — reversed,
    /// the array names #2 as the first claimant and the tree is the same one (#919).
    @Test(arguments: [false, true])
    func `a child claimed by two parents is drawn once, under the lower number`(reversed: Bool) {
        let served = reversed ? Self.contested.reversed() : Self.contested
        let room = TicketsRoomProjection.room(from: TicketsFixture.reading(of: Array(served)))

        #expect(TicketsRoomProjection.drawn(room.backlog, shut: []).map(\.id) == [2, 1, 3])
    }

    /// A provider that serves a cycle must not cost the reader the rows inside it. The edge that
    /// closes the loop is refused, and every item is still drawn exactly once.
    @Test(arguments: [false, true])
    func `a cycle in the child edge leaves every row drawn`(reversed: Bool) {
        let items = [
            Ticket(number: 1, title: "First", status: "Todo", closure: .open, children: [2]),
            Ticket(number: 2, title: "Second", status: "Todo", closure: .open, children: [1]),
        ]
        let served = reversed ? items.reversed() : items
        let room = TicketsRoomProjection.room(from: TicketsFixture.reading(of: Array(served)))

        #expect(TicketsRoomProjection.drawn(room.backlog, shut: []).map(\.id) == [1, 2])
    }

    /// The view filters the SET, and the tree is built over what survives: a child whose parent the
    /// view excluded hangs at the root rather than disappearing with it.
    @Test
    func `a child whose parent the view filtered out becomes a root`() {
        let room = TicketsRoomProjection.room(from: TicketsFixture.reading, in: .inProgress)

        #expect(room.backlog.map(\.id) == [763, 609, 388])
        #expect(room.backlog.flatMap(\.children).isEmpty)
    }
}

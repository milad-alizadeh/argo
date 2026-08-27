import ArgoEngine
@testable import ArgoUI
import Testing

/// What the backlog reads off the CHILD EDGE (#814). The tree is derived from `WorkItem.children`
/// rather than written down nested, so a provider that reparents a ticket moves the row without
/// anybody editing a literal — and the two ways an edge can lie (a second parent, a cycle) resolve
/// to a root rather than to a vanished row.
@Suite("The backlog nests")
struct WorkBacklogTreeTests {
    @Test
    func `a parent draws its open children under it`() {
        let room = WorkRoomProjection.room(from: WorkFixture.reading)

        #expect(room.backlog.map(\.id) == [607, 763, 275, 160, 185])
        #expect(room.backlog.first?.children.map(\.id) == [609, 388, 272, 273, 334])
    }

    /// The list draws what is OPEN; the edge names more than that. #607 carries nine children, two
    /// of them closed and two the poll never reached, and none of the four is a row.
    @Test
    func `a closed child is an edge the list does not draw`() {
        let room = WorkRoomProjection.room(from: WorkFixture.reading)

        #expect(room.backlog.first?.children.map(\.id).contains(690) == false)
        #expect(room.backlog.first?.trailing == "2/9")
    }

    @Test
    func `a child of a child nests one step further`() {
        let room = WorkRoomProjection.room(from: WorkFixture.reading)

        let route = room.backlog.first?.children.first { $0.id == 334 }
        #expect(route?.children.map(\.id) == [335, 336])
        #expect(route?.trailing == "0/2")
    }

    /// Flattened, the tree is the same twelve rows in the same order the flat list drew — nesting
    /// changes where a row is INSET, never which rows there are.
    @Test
    func `the drawn order is every open item, parents before their children`() {
        let room = WorkRoomProjection.room(from: WorkFixture.reading)

        let drawn = WorkRoomProjection.drawn(room.backlog, shut: [])
        #expect(drawn.map(\.id) == [607, 609, 388, 272, 273, 334, 335, 336, 763, 275, 160, 185])
        #expect(drawn.map(\.depth) == [0, 1, 1, 1, 1, 1, 2, 2, 0, 0, 0, 0])
    }

    /// Folding hides the subtree whole, not one level of it.
    @Test
    func `a shut parent draws neither its children nor their children`() {
        let room = WorkRoomProjection.room(from: WorkFixture.reading)

        let drawn = WorkRoomProjection.drawn(room.backlog, shut: [607])
        #expect(drawn.map(\.id) == [607, 763, 275, 160, 185])
    }

    /// A shut parent is still a parent: the twist has to stay, or nothing could open it again.
    @Test
    func `a shut parent keeps its twist and a leaf never grows one`() {
        let room = WorkRoomProjection.room(from: WorkFixture.reading)

        let drawn = WorkRoomProjection.drawn(room.backlog, shut: [607])
        #expect(drawn.first?.isParent == true)
        #expect(drawn.last?.isParent == false)
    }

    /// Two parents claiming one child would draw that child twice, and a reader counting rows would
    /// count it twice. The first edge served wins and the second is dropped.
    @Test
    func `a child claimed by two parents is drawn once`() {
        let items = [
            WorkItem(number: 1, title: "First", status: "Todo", closure: .open, children: [3]),
            WorkItem(number: 2, title: "Second", status: "Todo", closure: .open, children: [3]),
            WorkItem(number: 3, title: "Shared", status: "Todo", closure: .open),
        ]
        let room = WorkRoomProjection.room(from: WorkFixture.reading(of: items))

        #expect(WorkRoomProjection.drawn(room.backlog, shut: []).map(\.id) == [1, 3, 2])
    }

    /// A provider that serves a cycle must not cost the reader the rows inside it. The edge that
    /// closes the loop is refused, and every item is still drawn exactly once.
    @Test
    func `a cycle in the child edge leaves every row drawn`() {
        let items = [
            WorkItem(number: 1, title: "First", status: "Todo", closure: .open, children: [2]),
            WorkItem(number: 2, title: "Second", status: "Todo", closure: .open, children: [1]),
        ]
        let room = WorkRoomProjection.room(from: WorkFixture.reading(of: items))

        #expect(WorkRoomProjection.drawn(room.backlog, shut: []).map(\.id) == [1, 2])
    }

    /// The view filters the SET, and the tree is built over what survives: a child whose parent the
    /// view excluded hangs at the root rather than disappearing with it.
    @Test
    func `a child whose parent the view filtered out becomes a root`() {
        let room = WorkRoomProjection.room(from: WorkFixture.reading, in: .inProgress)

        #expect(room.backlog.map(\.id) == [609, 388, 763])
        #expect(room.backlog.flatMap(\.children).isEmpty)
    }
}

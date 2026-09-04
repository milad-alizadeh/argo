import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

/// The order the backlog draws in is Argo's own (#892). Every ticket below is served in an order
/// no key explains, so a room that passed the provider's array through fails all of these.
@Suite("The backlog states its own order")
@MainActor
struct TicketsBacklogOrderTests {
    /// Six tickets in an order that is neither the lowest number first nor the highest: #45 is the
    /// first of them and the provider served it second, which is the reported symptom.
    private static let served: [Ticket] = [
        ticket(120, priority: "high", children: [45, 900, 300]),
        ticket(45, priority: "low"),
        ticket(1004, priority: "high"),
        ticket(900, priority: "low"),
        ticket(88, priority: "high"),
        ticket(300, priority: "medium"),
    ]

    /// The roots as the list states them, lowest number first, whatever order they were served in.
    private static let lowestFirst = [88, 120, 1004]

    private static var room: TicketsRoomProjection.Room {
        TicketsRoomProjection.room(from: TicketsFixture.reading(of: served))
    }

    @Test
    func `the lowest-numbered root is the first row, wherever the provider served it`() {
        #expect(Self.room.backlog.map(\.id) == Self.lowestFirst)
    }

    /// A child sorts against its siblings, never against the roots: #900 sorts past every root it
    /// is shown beside and stays under #120.
    @Test
    func `children sort by the same key, among themselves`() {
        #expect(Self.room.backlog.first { $0.id == 120 }?.children.map(\.id) == [45, 300, 900])
    }

    /// The order is a property of the list, not of the reader's place in it.
    @Test
    func `opening a ticket moves no row`() {
        let opened = TicketsFixture.reading(of: Self.served).opened(at: 88)

        #expect(TicketsRoomProjection.room(from: opened).backlog.map(\.id) == Self.lowestFirst)
    }

    /// The bands keep the order their headers stand in; this is about the rows inside one.
    @Test
    func `a band draws its own roots lowest number first`() {
        let bands = TicketsRoomProjection.bands(of: Self.room.backlog)

        #expect(bands.map(\.priority) == ["high"])
        #expect(bands.map { $0.roots.map(\.id) } == [Self.lowestFirst])
    }

    private static func ticket(_ number: Int, priority: String, children: [Int] = []) -> Ticket {
        Ticket(
            number: number, title: "Ticket \(number)", status: "Todo", closure: .open,
            priority: priority, children: children, blockedBy: [],
        )
    }
}

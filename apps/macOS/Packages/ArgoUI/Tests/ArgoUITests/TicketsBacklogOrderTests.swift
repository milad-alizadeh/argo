import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

/// The order the backlog draws in is Argo's own (#892). Every ticket below is served in an order
/// no key explains, so a room that passed the provider's array through fails all of these.
@Suite("The backlog states its own order")
@MainActor
struct TicketsBacklogOrderTests {
    /// Six tickets in an order that is neither the newest first nor the oldest: #1004 is the one
    /// just filed and the provider served it in the middle, which is the reported symptom.
    private static let served: [Ticket] = [
        ticket(120, priority: "high", children: [45, 900, 300]),
        ticket(45, priority: "low"),
        ticket(1004, priority: "high"),
        ticket(900, priority: "low"),
        ticket(88, priority: "high"),
        ticket(300, priority: "medium"),
    ]

    /// The roots as the list states them, newest first, whatever order they were served in.
    private static let newestFirst = [1004, 120, 88]

    private static var room: TicketsRoomProjection.Room {
        TicketsRoomProjection.room(from: TicketsFixture.reading(of: served))
    }

    @Test
    func `the ticket just filed is the first row, wherever the provider served it`() {
        #expect(Self.room.backlog.map(\.id) == Self.newestFirst)
    }

    /// A child sorts against its siblings, never against the roots: #900 outranks the root it
    /// hangs under and stays under it.
    @Test
    func `children sort by the same key, among themselves`() {
        #expect(Self.room.backlog.first { $0.id == 120 }?.children.map(\.id) == [900, 300, 45])
    }

    /// The order is a property of the list, not of the reader's place in it.
    @Test
    func `opening a ticket moves no row`() {
        let opened = TicketsFixture.reading(of: Self.served).opened(at: 88)

        #expect(TicketsRoomProjection.room(from: opened).backlog.map(\.id) == Self.newestFirst)
    }

    /// The bands keep the order their headers stand in; this is about the rows inside one.
    @Test
    func `a band draws its own roots newest first`() {
        let bands = TicketsRoomProjection.bands(of: Self.room.backlog)

        #expect(bands.map(\.priority) == ["high"])
        #expect(bands.map { $0.roots.map(\.id) } == [Self.newestFirst])
    }

    private static func ticket(_ number: Int, priority: String, children: [Int] = []) -> Ticket {
        Ticket(
            number: number, title: "Ticket \(number)", status: "Todo", closure: .open,
            priority: priority, children: children, blockedBy: [],
        )
    }
}

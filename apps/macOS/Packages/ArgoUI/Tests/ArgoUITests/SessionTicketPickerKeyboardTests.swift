@testable import ArgoUI
import Testing

/// The acceptance the ticket is written to (#1231): Ticket #1217 is linked with the keyboard
/// alone, in one search and one Return. `SessionTicketSearchTests` asserts what a query keeps and
/// `MenuCursorTests` asserts the walking; this asserts the two against each other, which is what
/// decides the Ticket Return actually lands on.
@Suite("Session ticket picker keyboard")
struct SessionTicketPickerKeyboardTests {
    private let backlog: [SessionTicketLinking.Option] = [
        .init(number: 1231, title: "Link a ticket opens the whole backlog"),
        .init(number: 1217, title: "Anchor the feed on its newest line"),
        .init(number: 1092, title: "Route between Session and Ticket"),
        .init(number: 476, title: "The Work room reads the backlog"),
    ]

    @Test
    func `one search and one Return lands on the Ticket that was searched for`() {
        var cursor = MenuCursor<Int>()
        cursor.settle(over: numbers(on: ""))

        cursor.settle(over: numbers(on: "1217"))

        #expect(cursor.current == 1217)
    }

    /// With nothing typed the cursor is already on a row, so Return over an untouched picker links
    /// the newest Ticket rather than nothing.
    @Test
    func `an untouched picker already has a row under the cursor`() {
        var cursor = MenuCursor<Int>()
        cursor.settle(over: numbers(on: ""))

        #expect(cursor.current == 1231)
    }

    @Test
    func `down and up walk the results`() {
        var cursor = MenuCursor<Int>()
        let numbers = numbers(on: "")
        cursor.settle(over: numbers)

        cursor.down(over: numbers)
        #expect(cursor.current == 1217)

        cursor.up(over: numbers)
        #expect(cursor.current == 1231)
    }

    /// A query that narrows past the row the cursor was on moves it back to the top, so Return
    /// never lands on a Ticket that is no longer drawn.
    @Test
    func `a query that narrows past the cursor takes it back to the top`() {
        var cursor = MenuCursor<Int>()
        cursor.settle(over: numbers(on: ""))
        cursor.down(over: numbers(on: ""))
        #expect(cursor.current == 1217)

        cursor.settle(over: numbers(on: "backlog"))

        #expect(cursor.current == 1231)
    }

    /// Nothing matched is nothing under the cursor, which is what leaves Return linking nothing
    /// while the reader is still mid-query.
    @Test
    func `a query nothing matches leaves no row for Return`() {
        var cursor = MenuCursor<Int>()
        cursor.settle(over: numbers(on: ""))

        cursor.settle(over: numbers(on: "zzz"))

        #expect(cursor.current == nil)
    }

    private func numbers(on query: String) -> [Int] {
        SessionTicketSearch.matches(over: backlog, on: query).map(\.id)
    }
}

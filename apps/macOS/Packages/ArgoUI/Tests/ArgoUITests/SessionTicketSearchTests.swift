@testable import ArgoUI
import Testing

/// What the ticket picker's field narrows the backlog to (#1231). The picker is keyboard-only
/// capable, so what a query keeps and how it is ordered is a behaviour rather than a look.
@Suite("Session ticket search")
struct SessionTicketSearchTests {
    /// The order the backlog serves: newest first, which is what an empty field must keep.
    private let backlog: [SessionTicketLinking.Option] = [
        .init(number: 1231, title: "Link a ticket opens the whole backlog"),
        .init(number: 1217, title: "Anchor the feed on its newest line"),
        .init(number: 476, title: "Route between Session and Ticket"),
    ]

    @Test
    func `an empty query keeps every ticket in the order the backlog served them`() {
        let matches = SessionTicketSearch.matches(over: backlog, on: "")

        #expect(matches.map(\.id) == [1231, 1217, 476])
    }

    /// Whitespace alone is a field nobody has typed in yet, not a query nothing matches.
    @Test
    func `a query of whitespace alone reads as an empty one`() {
        let matches = SessionTicketSearch.matches(over: backlog, on: "   ")

        #expect(matches.map(\.id) == [1231, 1217, 476])
    }

    @Test
    func `a number narrows to the ticket carrying it`() {
        let matches = SessionTicketSearch.matches(over: backlog, on: "1217")

        #expect(matches.map(\.id) == [1217])
    }

    /// The number is drawn with a `#`, so a reader who types the mark they read elsewhere finds
    /// the same row as one who types the digits alone.
    @Test
    func `the number mark is typeable`() {
        let matches = SessionTicketSearch.matches(over: backlog, on: "#476")

        #expect(matches.map(\.id) == [476])
    }

    @Test
    func `a title fragment narrows to the ticket carrying it`() {
        let matches = SessionTicketSearch.matches(over: backlog, on: "feed")

        #expect(matches.map(\.id) == [1217])
    }

    @Test
    func `matching ignores case`() {
        let matches = SessionTicketSearch.matches(over: backlog, on: "ROUTE")

        #expect(matches.map(\.id) == [476])
    }

    /// A number typed is a number meant. The row whose own number carries the characters stands
    /// above one that merely says them in its sentence, however recent that one is.
    @Test
    func `a ticket matched on its number outranks one matched in its title`() {
        let backlog: [SessionTicketLinking.Option] = [
            .init(number: 990, title: "Follow up on 476"),
            .init(number: 476, title: "Route between Session and Ticket"),
        ]

        let matches = SessionTicketSearch.matches(over: backlog, on: "476")

        #expect(matches.map(\.id) == [476, 990])
    }

    /// What the row inks in the accent: the characters the reader typed, wherever they landed in
    /// the label — which is `#476: Route…`, so a title match is offset by the mark and its joiner.
    @Test
    func `it says where in the label the query landed`() {
        let matches = SessionTicketSearch.matches(over: backlog, on: "Route")

        #expect(matches.first?.matched == 6 ..< 11)
    }

    /// An empty query highlights nothing rather than the whole row.
    @Test
    func `an empty query marks no characters`() {
        let matches = SessionTicketSearch.matches(over: backlog, on: "")

        #expect(matches.allSatisfy { $0.matched.isEmpty })
    }

    @Test
    func `a query nothing carries keeps nothing`() {
        let matches = SessionTicketSearch.matches(over: backlog, on: "zzz")

        #expect(matches.isEmpty)
    }
}

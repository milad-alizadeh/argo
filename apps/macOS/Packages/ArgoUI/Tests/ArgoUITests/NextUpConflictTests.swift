import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

/// The `.lowConflict` chip (#1384): earned only where a running Session's own claim named a chart
/// to compare against AND this pick's own chart is known and sits outside every one of them — the
/// same honesty rule the other three reasons in `NextUpTests` already follow.
@Suite("Next-up in-flight conflict chip")
@MainActor
struct NextUpConflictTests {
    /// The chip names the input the ranking's own conflict key reads: #2's chart (#8) holds no
    /// claimed ticket, where #7 — the other chart in this backlog — holds #99, which a Session has
    /// claimed.
    @Test
    func `a pick outside every in-flight chart earns the low-conflict chip`() throws {
        let reading = Self.conflictReading(claiming: [99])

        try #expect(Self.pick(in: reading).reasons == [.next(chart: "#8"), .lowConflict])
    }

    /// With nothing claimed there is no in-flight footprint to read "outside of" — the honest
    /// suppression, not a claim of zero conflict against nothing.
    @Test
    func `with nothing claimed the low-conflict chip is suppressed`() throws {
        let reading = Self.conflictReading(claiming: [])

        try #expect(Self.pick(in: reading).reasons == [.next(chart: "#8")])
    }

    /// A pick in no chart at all has no chart of its own to compare — asserting it is clear of a
    /// footprint it was never checked against would be exactly the inference this tier refuses.
    @Test
    func `a pick in no chart never earns the low-conflict chip`() throws {
        let chart = Ticket(
            number: 7, title: "Chart A", status: "Todo", closure: .open, type: "PRD",
            children: [99],
        )
        let loose = Ticket(number: 2, title: "Loose leaf", status: "Todo", closure: .open)
        var reading = TicketsFixture.reading(of: [chart, loose])
        reading.claims = TicketClaims(numbers: [99])

        try #expect(Self.pick(in: reading).reasons.isEmpty)
    }

    private static func pick(in reading: TicketsReading) throws -> NextUp.Pick {
        try NextUpPick.of(TicketsRoomProjection.room(from: reading))
    }

    /// Two charts, #7 with #99 alongside the pick's own chart's rival and #8 holding the pick
    /// itself (#2) — the one fact `claiming` varies.
    private static func conflictReading(claiming numbers: Set<Int>) -> TicketsReading {
        let chartA = Ticket(
            number: 7, title: "Chart A", status: "Todo", closure: .open, type: "PRD",
            children: [99],
        )
        let chartB = Ticket(
            number: 8, title: "Chart B", status: "Todo", closure: .open, type: "PRD",
            children: [2],
        )
        let leafB = Ticket(number: 2, title: "Leaf B", status: "Todo", closure: .open)
        var reading = TicketsFixture.reading(of: [chartA, chartB, leafB])
        reading.claims = TicketClaims(numbers: numbers)
        return reading
    }
}

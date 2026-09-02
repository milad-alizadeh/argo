@testable import ArgoUI
import Testing

/// When the hero re-ranks (#273). It is a live PROJECTION with no timer and no fetch of its own:
/// every case here re-derives the room from a changed reading and nothing else, which is the whole
/// mechanism — the poll writes the listing, the roster writes the claims, and both are inputs to a
/// pure derivation.
@Suite("Next-up cadence")
@MainActor
struct NextUpCadenceTests {
    private static let pool = [
        TicketsFixture.candidate(1, priority: "high", day: 5),
        TicketsFixture.candidate(2, priority: "medium", day: 5),
    ]

    /// A poll delta is the whole re-rank: the listing arrives with the pick closed, and the hero
    /// names the next one on the same ladder.
    @Test
    func `a poll that closes the pick moves the hero to the next candidate`() throws {
        let before = TicketsFixture.reading(of: Self.pool)
        let after = TicketsFixture.reading(of: [
            TicketsFixture.resolved(Self.pool[0]),
            Self.pool[1],
        ])

        try #expect(Self.pick(in: before).number == 1)
        try #expect(Self.pick(in: after).number == 2)
    }

    /// A priority the provider raised between two polls re-ranks on the next listing, with nothing
    /// local having changed at all.
    @Test
    func `a priority raised between two polls re-ranks on the next listing`() throws {
        let raised = TicketsFixture.reading(of: [
            TicketsFixture.candidate(1, priority: "low", day: 5),
            TicketsFixture.candidate(2, priority: "high", day: 5),
        ])

        try #expect(Self.pick(in: raised).number == 2)
    }

    /// A Session starting locally takes its ticket out of the pool at once — no poll involved: the
    /// claim is Argo's own fact and never the provider's.
    @Test
    func `a session starting on the pick hands the hero to the next one`() throws {
        var started = TicketsFixture.reading(of: Self.pool)
        started.claims = TicketClaims(numbers: [1])

        try #expect(Self.pick(in: started).number == 2)
    }

    /// And stopping puts it back, on the same terms. The pool is derived per read rather than
    /// remembered, so nothing has to be invalidated for this to happen.
    @Test
    func `a session stopping puts its ticket back at the head`() throws {
        var stopped = TicketsFixture.reading(of: Self.pool)
        stopped.claims = TicketClaims(numbers: [])

        try #expect(Self.pick(in: stopped).number == 1)
    }

    /// The proof there is no timer: the hero is a function of the reading alone, so two derivations
    /// of ONE unchanged reading are the same value. Anything clock-driven in the ranking would show
    /// up here as two rooms that differ without an input having moved.
    @Test
    func `two derivations of one unchanged reading are the same hero`() {
        let reading = TicketsFixture.reading(of: Self.pool)

        #expect(
            TicketsRoomProjection.room(from: reading).nextUp
                == TicketsRoomProjection.room(from: reading).nextUp,
        )
    }

    private static func pick(in reading: TicketsReading) throws -> NextUp.Pick {
        try NextUpPick.of(reading)
    }
}

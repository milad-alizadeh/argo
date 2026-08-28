import ArgoEngine
@testable import ArgoUI
import Testing

/// Which ticket the hero offers, and why that one (#273). The ranking is `priority desc → PRD
/// sequence → age` and nothing else — every case here states the pool and the one input meant to
/// decide it, so a reader can re-run the ranking by hand.
@Suite("Next-up ranking")
struct NextUpRankingTests {
    /// Priority is the FIRST key, so it outranks both tie-breaks at once: #2 is earlier in the PRD
    /// and older, and still loses to a `high` word.
    @Test
    func `priority outranks every key beneath it`() throws {
        let pool = [
            TicketsFixture.candidate(2, priority: "low", day: 1),
            TicketsFixture.candidate(1, priority: "high", day: 9),
        ]
        let reading = TicketsFixture
            .reading(of: [TicketsFixture.chart(7, sequencing: [2, 1])] + pool)

        try #expect(Self.pick(in: reading).number == 1)
    }

    /// The ladder is the engine's, and it is a ladder rather than one matched word: `medium` beats
    /// `low` with nothing else to separate them.
    @Test
    func `the middle rung outranks the bottom one`() throws {
        let reading = TicketsFixture.reading(of: [
            TicketsFixture.candidate(1, priority: "low", day: 1),
            TicketsFixture.candidate(2, priority: "medium", day: 1),
        ])

        try #expect(Self.pick(in: reading).number == 2)
    }

    /// A word the ladder does not know sits below `low` — and, crucially, a ticket nobody read a
    /// priority for sits below THAT. Absent is not a rung.
    @Test
    func `an unknown word outranks no priority read at all`() throws {
        let reading = TicketsFixture.reading(of: [
            TicketsFixture.candidate(1, day: 1),
            TicketsFixture.candidate(2, priority: "P0", day: 1),
        ])

        try #expect(Self.pick(in: reading).number == 2)
    }

    /// Two unknown words are not ordered against each other, so the pick falls through to age. The
    /// ladder says both sit below `low` and says nothing further.
    @Test
    func `two unknown words fall through to the age beneath them`() throws {
        let reading = TicketsFixture.reading(of: [
            TicketsFixture.candidate(1, priority: "P0", day: 9),
            TicketsFixture.candidate(2, priority: "urgent-ish", day: 1),
        ])

        try #expect(Self.pick(in: reading).number == 2)
    }

    /// With the rungs level the PRD's own order decides — and it decides AGAINST age, which is the
    /// key below it: #2 is the older ticket and the PRD put #1 first.
    @Test
    func `the PRD sequence outranks the age beneath it`() throws {
        let pool = [
            TicketsFixture.candidate(2, priority: "medium", day: 1),
            TicketsFixture.candidate(1, priority: "medium", day: 9),
        ]
        let reading = TicketsFixture
            .reading(of: [TicketsFixture.chart(7, sequencing: [1, 2])] + pool)

        try #expect(Self.pick(in: reading).number == 1)
    }

    /// Across two charts the position alone decides nothing — nobody sequenced two PRDs against one
    /// another. The provider's own serve order of the charts does, which is the order `CHARTS`
    /// draws: #2 sits at position 0 of the second chart and still loses to the first chart's.
    @Test
    func `a ticket in a later chart loses to one in an earlier chart`() throws {
        let pool = [TicketsFixture.candidate(2, priority: "medium", day: 1)]
            + [TicketsFixture.candidate(1, priority: "medium", day: 9)]
        let charts = [
            TicketsFixture.chart(7, sequencing: [99, 1]),
            TicketsFixture.chart(8, sequencing: [2]),
        ]

        try #expect(Self.pick(in: TicketsFixture.reading(of: charts + pool)).number == 1)
    }

    /// A PRD's sequence is somebody stating an order. A ticket nobody sequenced does not overtake
    /// one on a statement nobody made — even where it is the older of the two.
    @Test
    func `a ticket in no chart sorts behind every ticket in one`() throws {
        let charted = TicketsFixture.candidate(1, priority: "medium", day: 9)
        let loose = TicketsFixture.candidate(2, priority: "medium", day: 1)
        let reading = TicketsFixture.reading(
            of: [TicketsFixture.chart(7, sequencing: [1])] + [charted, loose],
        )

        try #expect(Self.pick(in: reading).number == 1)
    }

    /// The last of the three inputs, and the oldest wins: the hero is a cold-start planner, and the
    /// ticket nobody has touched is the one most likely still to need starting.
    @Test
    func `the oldest wins where nothing above the age separates the two`() throws {
        let reading = TicketsFixture.reading(of: [
            TicketsFixture.candidate(1, priority: "medium", day: 9),
            TicketsFixture.candidate(2, priority: "medium", day: 1),
        ])

        try #expect(Self.pick(in: reading).number == 2)
    }

    /// A silence is not an age. A ticket nobody read a timestamp for sorts LAST rather than first:
    /// treating absent as ancient would put the least-known ticket at the head of the list
    /// (`CONTEXT.md` L2 · degrade-down).
    @Test
    func `a ticket with no timestamp read sorts behind one that has an age`() throws {
        let reading = TicketsFixture.reading(of: [
            TicketsFixture.candidate(1, priority: "medium"),
            TicketsFixture.candidate(2, priority: "medium", day: 9),
        ])

        try #expect(Self.pick(in: reading).number == 2)
    }

    /// The pool is `todo`, which is where an item a Session already holds leaves it. A claimed
    /// ticket that would otherwise rank first is not the answer to "what should I START".
    @Test
    func `a claimed leaf is out of the pool however it would rank`() throws {
        var reading = TicketsFixture.reading(of: [
            TicketsFixture.candidate(1, priority: "high", day: 1),
            TicketsFixture.candidate(2, priority: "low", day: 9),
        ])
        reading.claimed = [1]

        try #expect(Self.pick(in: reading).number == 2)
    }

    /// Nothing separates these two but their numbers, and the ranking still has to answer the same
    /// way twice — a hero that reshuffled under an unchanged listing would churn on every poll.
    @Test
    func `a pool the three inputs cannot separate still ranks the same way twice`() throws {
        let reading = TicketsFixture.reading(of: [
            TicketsFixture.candidate(9, priority: "medium", day: 1),
            TicketsFixture.candidate(4, priority: "medium", day: 1),
        ])

        try #expect(Self.pick(in: reading).number == 4)
        try #expect(Self.pick(in: TicketsFixture.reading(of: reading.items.reversed())).number == 4)
    }

    private static func pick(in reading: TicketsReading) throws -> NextUp.Pick {
        try NextUpPick.of(reading)
    }
}

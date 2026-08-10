import ArgoEngine
@testable import ArgoUI
import Testing

/// The spend line's whole content decision, asserted where it is made.
///
/// Its own suite beside `SessionHeaderContextTests` for the same reason that one exists: this line
/// is composed from facts that are frequently absent, and every rule about what happens when one of
/// them is missing is a rule a view could satisfy in a screenshot and break the next Session.
@Suite("Session header spend")
struct SessionHeaderSpendTests {
    private let minute = 60000

    /// Story 53, and the assertion this ticket exists for. `nil` is a fact nobody reported and it
    /// leaves the line; a zero is a fact somebody reported and it renders — the two are opposite
    /// claims, and `0 in subagents` would say no subagent ran.
    @Test
    func `an unreported subagent spend leaves the line, while a reported zero renders`() throws {
        let unreported = try #require(spend(subagentTokens: nil))
        let zero = try #require(spend(subagentTokens: 0))

        #expect(!unreported.contains("subagents"))
        #expect(zero.contains("0 in subagents"))
        // And nothing else moved: the absence takes its own separator with it rather than
        // leaving the line spelled `cache ·  · started`.
        #expect(unreported == "1.83M tokens spent · 28.1M cached · started 2h ago · worked 20m")
        #expect(zero
            == "1.83M tokens spent · 28.1M cached · 0 in subagents · started 2h ago · worked 20m")
    }

    /// The line composes from what is PRESENT. A Session none of it could be read from carries no
    /// line at all rather than a run of separators with nothing between them.
    @Test
    func `absent facts collapse the line rather than leaving stray separators`() {
        #expect(SessionHeaderProjection.spend(from: session()) == nil)
        // One fact is a whole line, with no separator on either side of it.
        #expect(SessionHeaderProjection.spend(from: session(spentTokens: 29_930_000))
            == "29.93M tokens spent")
    }

    /// Both durations, always, because either alone is read as the other: `5h 51m` of wall clock
    /// is not five hours of agent time, and on a real Session the two differ by 5–8×.
    @Test
    func `the line carries wall-clock and worked time as two separate facts`() throws {
        let line = try #require(spend(subagentTokens: nil))

        #expect(line.contains("started 2h ago"))
        #expect(line.contains("worked 20m"))
    }

    /// Wall clock is the transcript's first record to its last — a span, not a reading of the
    /// machine's clock, which would report a Session that stopped last Tuesday as still going.
    @Test
    func `the span is the transcript's own two ends, and needs both of them`() {
        #expect(SessionHeaderProjection.ran(from: session(
            startedAtMs: 1000, lastSeenAtMs: 1000 + 351 * minute,
        )) == 351 * minute)
        #expect(SessionHeaderProjection.ran(from: session(startedAtMs: 1000)) == nil)
        #expect(SessionHeaderProjection.ran(from: session(lastSeenAtMs: 1000)) == nil)
    }

    /// The cutoff is the rule: a gap below it is an agent thinking, and one at or above it is the
    /// user away from the keyboard. Asserted ON the boundary, because an off-by-one here silently
    /// counts a lunch break as work.
    @Test
    func `a gap shorter than the cutoff counts as work, and one at the cutoff does not`() {
        let cutoff = SessionHeaderProjection.SpendPolicy.awayGapMs

        #expect(SessionHeaderProjection.worked(across: calls(at: [0, cutoff - 1])) == cutoff - 1)
        #expect(SessionHeaderProjection.worked(across: calls(at: [0, cutoff])) == 0)
        #expect(SessionHeaderProjection.SpendPolicy.awayGapMs == 5 * minute)
    }

    /// A Session that was left alone all day worked none of it, and that zero is REAL — it is read
    /// off gaps that were all too long, not off a record that said nothing.
    @Test
    func `worked is absent with nothing to measure and zero when nothing was measured`() {
        #expect(SessionHeaderProjection.worked(across: []) == nil)
        #expect(SessionHeaderProjection.worked(across: calls(at: [0])) == nil)
        #expect(SessionHeaderProjection.worked(across: calls(at: [0, 60 * minute])) == 0)
        // Rendered rather than dropped — and said as none of it, because `under a minute` would
        // spell a Session left alone all day exactly like one that has just started.
        #expect(SessionHeaderProjection.spend(from: session(
            events: calls(at: [0, 60 * minute]),
        )) == "worked none of it")
    }

    /// The moments are sorted before the gaps between them are taken. A resume chain is stitched
    /// from more than one file, and a gap is only a gap if it runs between neighbours.
    @Test
    func `moments out of order are put in order before the gaps are taken`() {
        let ordered = SessionHeaderProjection.worked(across: calls(at: [0, minute, 2 * minute]))
        let jumbled = SessionHeaderProjection.worked(across: calls(at: [2 * minute, 0, minute]))

        #expect(ordered == 2 * minute)
        #expect(jumbled == ordered)
    }

    /// Durations keep their minutes. The roster rounds an age to one unit because a switcher only
    /// needs its order explained; here the two durations are read against EACH OTHER, and `5h`
    /// beside `5h` would hide the ratio the line exists to show.
    @Test
    func `a duration is said to the minute, and a span under one is said in words`() {
        #expect(ElapsedTime.phrase(milliseconds: 351 * minute) == "5h 51m")
        #expect(ElapsedTime.phrase(milliseconds: 73 * minute) == "1h 13m")
        #expect(ElapsedTime.phrase(milliseconds: 120 * minute) == "2h")
        #expect(ElapsedTime.phrase(milliseconds: 51 * minute) == "51m")
        #expect(ElapsedTime.phrase(milliseconds: 59000) == "under a minute")
        // A clock reading behind the record it measures is two machines disagreeing, not a
        // Session that ran backwards.
        #expect(ElapsedTime.phrase(milliseconds: -5000) == "under a minute")
    }

    /// The PNGs are the only evidence the rendering has, and the pair is the render: the line with
    /// the subagent fact and the line without it are only judgeable against each other.
    @Test
    func `both spend lines have a specimen of their own`() {
        let drawn = SessionSpendFixture.spends

        #expect(drawn.map(\.specimen) == [.sessionSpend, .sessionSpendUnreported])
        #expect(drawn.map { $0.header.spend?.contains("in subagents") } == [true, false])
    }

    /// A Session with a fixed spend and a rhythm of work behind it, so only the fact under test
    /// moves: two hours spanned, twenty minutes of it worked.
    private func spend(subagentTokens: Int?) -> String? {
        SessionHeaderProjection.spend(from: session(
            startedAtMs: 0,
            lastSeenAtMs: 120 * minute,
            spentTokens: 1_830_000,
            cachedTokens: 28_100_000,
            subagentTokens: subagentTokens,
            events: calls(at: burst(from: 0) + burst(from: 110 * minute)),
        ))
    }

    /// Ten minutes of calls a minute apart — the rhythm the cutoff is meant to count. Two of them
    /// with an hour and a half of nothing in between is the shape of a real working day.
    private func burst(from startMs: Int) -> [Int] {
        (0 ... 10).map { startMs + $0 * minute }
    }

    /// Calls at the given moments — the transcript reduced to the one thing a duration reads.
    private func calls(at moments: [Int]) -> [TranscriptEvent] {
        moments.enumerated().map { index, atMs in
            .toolCall(ToolCall(
                id: "call-\(index)",
                name: "Read",
                kind: .read,
                target: "CONTEXT.md",
                atMs: atMs,
            ))
        }
    }

    private func session(
        startedAtMs: Int? = nil,
        lastSeenAtMs: Int? = nil,
        spentTokens: Int? = nil,
        cachedTokens: Int? = nil,
        subagentTokens: Int? = nil,
        events: [TranscriptEvent] = [],
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "session",
            title: "Session",
            model: "claude-opus-5",
            workspaceLocation: "/Users/milad/Developer/argo",
            access: .managed,
            status: .idle,
            lastSeenAtMs: lastSeenAtMs,
            startedAtMs: startedAtMs,
            spentTokens: spentTokens,
            cachedTokens: cachedTokens,
            subagentTokens: subagentTokens,
            events: events,
        )
    }
}

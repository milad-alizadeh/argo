import ArgoEngine
@testable import ArgoUI
import Testing

/// The spend line's whole content decision, asserted where it is made.
@Suite("Session header spend")
struct SessionHeaderSpendTests {
    private let minute = 60000

    /// `nil` is a fact nobody reported; a zero is a fact somebody reported — opposite claims.
    @Test
    func `an unreported subagent spend leaves the line, while a reported zero renders`() throws {
        let unreported = try #require(spend(subagentTokens: nil))
        let zero = try #require(spend(subagentTokens: 0))

        #expect(!unreported.contains("subagents"))
        #expect(zero.contains("0 in subagents"))
        // The absence takes its own separator with it, not leaving `cache ·  · started`.
        #expect(unreported == "1.83M tokens spent · 28.1M cached · started 2h ago · worked 20m")
        #expect(zero
            == "1.83M tokens spent · 28.1M cached · 0 in subagents · started 2h ago · worked 20m")
    }

    @Test
    func `absent facts collapse the line rather than leaving stray separators`() {
        #expect(SessionHeaderProjection.spend(from: session()) == nil)
        // One fact is a whole line, with no separator on either side of it.
        #expect(SessionHeaderProjection.spend(from: session(spentTokens: 29_930_000))
            == "29.93M tokens spent")
    }

    /// Both durations, always: on a real Session wall clock and worked time differ by 5–8×.
    @Test
    func `the line carries wall-clock and worked time as two separate facts`() throws {
        let line = try #require(spend(subagentTokens: nil))

        #expect(line.contains("started 2h ago"))
        #expect(line.contains("worked 20m"))
    }

    /// Wall clock is the transcript's first record to its last, never the machine's clock — that
    /// would report a Session that stopped last Tuesday as still going.
    @Test
    func `the span is the transcript's own two ends, and needs both of them`() {
        #expect(SessionHeaderProjection.ran(from: session(
            startedAtMs: 1000, lastSeenAtMs: 1000 + 351 * minute,
        )) == 351 * minute)
        #expect(SessionHeaderProjection.ran(from: session(startedAtMs: 1000)) == nil)
        #expect(SessionHeaderProjection.ran(from: session(lastSeenAtMs: 1000)) == nil)
    }

    /// A gap below the cutoff is an agent thinking; one at or above it is the user away.
    @Test
    func `a gap shorter than the cutoff counts as work, and one at the cutoff does not`() {
        let cutoff = SessionHeaderProjection.SpendPolicy.awayGapMs

        #expect(SessionHeaderProjection.worked(across: calls(at: [0, cutoff - 1])) == cutoff - 1)
        #expect(SessionHeaderProjection.worked(across: calls(at: [0, cutoff])) == 0)
        #expect(SessionHeaderProjection.SpendPolicy.awayGapMs == 5 * minute)
    }

    /// A zero here is REAL — read off gaps that were all too long, not off a silent record.
    @Test
    func `worked is absent with nothing to measure and zero when nothing was measured`() {
        #expect(SessionHeaderProjection.worked(across: []) == nil)
        #expect(SessionHeaderProjection.worked(across: calls(at: [0])) == nil)
        #expect(SessionHeaderProjection.worked(across: calls(at: [0, 60 * minute])) == 0)
        // Said as none of it, never as `under a minute`.
        #expect(SessionHeaderProjection.spend(from: session(
            events: calls(at: [0, 60 * minute]),
        )) == "worked none of it")
    }

    /// A resume chain is stitched from more than one file, so the moments arrive out of order.
    @Test
    func `moments out of order are put in order before the gaps are taken`() {
        let ordered = SessionHeaderProjection.worked(across: calls(at: [0, minute, 2 * minute]))
        let jumbled = SessionHeaderProjection.worked(across: calls(at: [2 * minute, 0, minute]))

        #expect(ordered == 2 * minute)
        #expect(jumbled == ordered)
    }

    /// Durations keep their minutes, unlike the roster's one-unit age.
    @Test
    func `a duration is said to the minute, and a span under one is said in words`() {
        #expect(ElapsedTime.phrase(milliseconds: 351 * minute) == "5h 51m")
        #expect(ElapsedTime.phrase(milliseconds: 73 * minute) == "1h 13m")
        #expect(ElapsedTime.phrase(milliseconds: 120 * minute) == "2h")
        #expect(ElapsedTime.phrase(milliseconds: 51 * minute) == "51m")
        #expect(ElapsedTime.phrase(milliseconds: 59000) == "under a minute")
        // A negative span is two machines' clocks disagreeing, not a Session that ran backwards.
        #expect(ElapsedTime.phrase(milliseconds: -5000) == "under a minute")
    }

    @Test
    func `both spend lines have a specimen of their own`() {
        let drawn = SessionSpendFixture.spends

        #expect(drawn.map(\.specimen) == [.sessionSpend, .sessionSpendUnreported])
        #expect(drawn.map { $0.header.spend?.contains("in subagents") } == [true, false])
    }

    /// A Session with a fixed spend: two hours spanned, twenty minutes of it worked.
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

    /// Ten minutes of calls a minute apart — the rhythm the cutoff is meant to count.
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

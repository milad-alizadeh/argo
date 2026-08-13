import ArgoEngine
@testable import ArgoUI
import Testing

/// The ⓘ panel's `This Session` block (#694) — every fact the titlebar's hover carries, plus the
/// context reading, as rows a reader can sit with. The order and the absences are asserted here
/// because a popover never lands in a screenshot.
@Suite("Session guide facts")
struct SessionHeaderGuideTests {
    private let minute = 60000

    /// The design's nine rows, in the design's order, on the one Session that has all of them.
    @Test
    func `the block says the design's nine rows, in order`() {
        let facts = SessionHeaderProjection.header(from: fullSession()).facts

        #expect(facts.map(\.term) == [
            "Context", "Tokens spent", "Cached", "Started", "Worked", "Agent", "Branch", "Issue",
            "Access",
        ])
    }

    /// The values are readings, never sentences — the panel sets this column in the machine face.
    @Test
    func `each row carries the reading itself`() {
        let facts = SessionHeaderProjection.header(from: fullSession()).facts
        let said = Dictionary(uniqueKeysWithValues: facts.map { ($0.term, $0.value) })

        #expect(said["Context"] == "217k / 1M")
        #expect(said["Tokens spent"] == "1.83M")
        #expect(said["Cached"] == "28.1M")
        #expect(said["Started"] == "2h ago")
        #expect(said["Worked"] == "20m")
        #expect(said["Agent"] == "Claude Code · Opus 5")
        // The marks hang off the branch, because nothing else in the deck renders them.
        #expect(said["Branch"] == "argo/#694-context-guide · 3 uncommitted files")
        // The term is already `Issue`, so the value is not `Issue #694` a second time.
        #expect(said["Issue"] == "#694 — The ⓘ panel says what the header stopped saying")
        #expect(said["Access"] == "Read-only")
    }

    /// A fact nobody reported is ABSENT — `0 cached` would claim a figure nobody measured.
    @Test
    func `a fact Argo does not have leaves the block rather than rendering a zero`() {
        let facts = SessionHeaderProjection.header(from: CockpitPresentation.Session(
            id: "guide-bare",
            title: "A Session read off an empty record",
            model: nil,
            workspaceLocation: nil,
            access: .managed,
            status: .idle,
        )).facts

        // The reading survives alone: an unreadable context is still a context, said as `unknown`.
        #expect(facts.map(\.term) == ["Context"])
        #expect(facts[0].value == "unknown")
    }

    /// A managed Session is the plain one, so it spends no `Access` row at all.
    @Test
    func `a plain managed Session says nothing about its access`() {
        let facts = SessionHeaderProjection.header(from: fullSession(access: .managed)).facts

        #expect(!facts.map(\.term).contains("Access"))
    }

    /// A real zero renders, because somebody measured it: every gap was too long to be work.
    @Test
    func `a Session that worked none of the time it ran says so`() {
        let facts = SessionHeaderProjection.header(from: fullSession(
            events: calls(at: [0, 60 * minute]),
        )).facts

        #expect(facts.first { $0.term == "Worked" }?.value == "none of it")
    }

    /// The one fact on the hover that the block does not say. It is `nil` on every CLI in use, so
    /// the row would be absent from every real Session — see the design's own note on it.
    @Test
    func `subagent spend stays on the line and off the block`() throws {
        let session = fullSession(subagentTokens: 4_100_000)
        let header = SessionHeaderProjection.header(from: session)

        #expect(try #require(header.spend).contains("4.1M in subagents"))
        #expect(!header.facts.map(\.term).contains("Subagents"))
    }

    /// The block reports and the legend explains: nothing per-Session is in the legend's words.
    @Test
    func `the legend stays policy, saying nothing about the Session it is opened over`() {
        let said = SessionHeaderProjection.Context.guide.map(\.threshold)
            + SessionHeaderProjection.Context.guide.map(\.meaning)
            + [SessionHeaderProjection.Context.remedy]

        #expect(said.allSatisfy { !$0.contains("217k") })
        #expect(SessionHeaderProjection.Context.guide.count == 2)
    }

    /// Every fact the block can carry, on one Session: two hours spanned, twenty minutes worked.
    private func fullSession(
        access: CockpitPresentation.Session.Access = .external,
        events: [TranscriptEvent]? = nil,
        subagentTokens: Int? = nil,
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "guide-full",
            title: "The ⓘ panel takes the facts the header demoted",
            model: "claude-opus-5",
            workspaceLocation: "/Users/milad/Developer/argo",
            access: access,
            status: .idle,
            cli: .claude,
            workspace: .init(kind: .worktree, branch: "argo/#694-context-guide", dirty: 3),
            issue: .init(
                number: 694,
                title: "The ⓘ panel says what the header stopped saying",
            ),
            lastSeenAtMs: 120 * minute,
            startedAtMs: 0,
            spentTokens: 1_830_000,
            cachedTokens: 28_100_000,
            subagentTokens: subagentTokens,
            contextTokens: 216_764,
            events: events ?? calls(at: burst(from: 0) + burst(from: 110 * minute)),
        )
    }

    /// Ten minutes of calls a minute apart — the rhythm the away cutoff is meant to count.
    private func burst(from startMs: Int) -> [Int] {
        (0 ... 10).map { startMs + $0 * minute }
    }

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
}

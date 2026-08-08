import ArgoEngine
@testable import ArgoUI
import Testing

/// What the feed is allowed to do to a transcript on the way to the screen, which is: almost
/// nothing. The stream is an observation, and every claim below is a claim that the projection
/// did not improve on it.
@Suite("Feed projection")
struct FeedProjectionTests {
    @Test
    func `rows come out in the stream's own order, never sorted or promoted`() {
        let rows = FeedProjection.rows(from: [
            .message(markdown: "Second."),
            .prompt(text: "Third.", atMs: 9000),
            .thought(markdown: "Fourth."),
            .prompt(text: "First.", atMs: 1000),
        ])

        // Nothing regrouped by kind, and the timestamps on the prompts sort nothing: the record's
        // order IS the reading, and a feed that re-ordered it would be describing a session that
        // never happened.
        #expect(rows.map(\.kind) == [.message, .prompt, .thought, .prompt])
        #expect(rows.map(\.text) == ["Second.", "Third.", "Fourth.", "First."])
    }

    @Test
    func `prose arrives verbatim — no trimming, no unwrapping, no reflow`() {
        let markdown = "  ## Heading\n\n- one\n- two\n\nTrailing space.  "

        let rows = FeedProjection.rows(from: [
            .message(markdown: markdown),
            .prompt(text: markdown, atMs: nil),
            .thought(markdown: markdown),
        ])

        #expect(rows.allSatisfy { $0.text == markdown })
    }

    @Test
    func `reasoning is a thought, never a message`() {
        let rows = FeedProjection.rows(from: [
            .thought(markdown: "Maybe the palette."),
            .message(markdown: "Maybe the palette."),
        ])

        // Same words, two different provenance claims. A projection that collapsed them would let
        // a turn's reasoning be read as its answer, which it routinely contradicts.
        #expect(rows.map(\.kind) == [.thought, .message])
    }

    @Test
    func `an event kind this feed does not handle yet produces no row`() {
        // Every kind this target can build. `toolCall`/`toolCallOutcome` are absent because their
        // payloads have no public initialiser — the projection's own `switch` carries no
        // `default`, so a kind nobody listed here still cannot be added without deciding it.
        let unhandled: [TranscriptEvent] = [
            .recordIdentity(uuid: "record"),
            .headLeaf(uuid: "leaf"),
            .title("A title"),
            .cwd("/tmp/project"),
            .model("claude-opus-5"),
            .branch("main"),
            .turnEnded(.endTurn),
            .plan(Plan(entries: [PlanEntry(text: "Ship it", status: .pending)])),
            .compaction(atMs: 1000),
            .unreadableLine(raw: "{"),
        ]

        // Each of these arrives with its own ticket. Until then the honest rendering is nothing at
        // all — a placeholder row would be Argo claiming a shape the surface has not decided.
        #expect(FeedProjection.rows(from: unhandled).isEmpty)
    }

    @Test
    func `a row is addressed by its own place in the feed`() {
        let rows = FeedProjection.rows(from: [
            .message(markdown: "Same."),
            .turnEnded(.endTurn),
            .message(markdown: "Same."),
        ])

        // Two identical messages are two rows, so identity cannot be the text; and the ids are
        // dense over the ROWS, so the events that drew none leave no gap for a list to animate.
        #expect(rows.map(\.id) == [0, 1])
    }
}

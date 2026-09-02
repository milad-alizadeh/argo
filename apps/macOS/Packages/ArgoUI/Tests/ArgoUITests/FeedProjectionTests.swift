import ArgoEngine
import ArgoFixtures
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
            .prompt(text: "Third.", images: [], atMs: 9000),
            .thought(markdown: "Fourth."),
            .prompt(text: "First.", images: [], atMs: 1000),
        ])

        // The prompts' timestamps sort nothing: the record's order IS the reading.
        #expect(rows.map(\.content) == [
            .message("Second."), .prompt(text: "Third.", shots: []), .thought("Fourth."), .prompt(
                text: "First.",
                shots: [],
            ),
        ])
    }

    @Test
    func `prose arrives verbatim — no trimming, no unwrapping, no reflow`() {
        let markdown = "  ## Heading\n\n- one\n- two\n\nTrailing space.  "

        let rows = FeedProjection.rows(from: [
            .message(markdown: markdown),
            .prompt(text: markdown, images: [], atMs: nil),
            .thought(markdown: markdown),
        ])

        #expect(rows.map(\.content) == [
            .message(markdown), .prompt(text: markdown, shots: []), .thought(markdown),
        ])
    }

    @Test
    func `reasoning is a thought, never a message`() {
        let rows = FeedProjection.rows(from: [
            .thought(markdown: "Maybe the palette."),
            .message(markdown: "Maybe the palette."),
        ])

        // Same words, two different provenance claims.
        #expect(rows.map(\.content) == [
            .thought("Maybe the palette."),
            .message("Maybe the palette."),
        ])
    }

    /// Each of these arrives with its own ticket. Until then the honest rendering is nothing at
    /// all — a placeholder row would be Argo claiming a shape the surface has not decided.
    @Test
    func `an event kind this feed does not handle yet produces no row`() {
        let unhandled: [TranscriptEvent] = [
            .recordIdentity(uuid: "record"),
            .headLeaf(uuid: "leaf"),
            .title("A title"),
            .cwd("/tmp/project"),
            .model("claude-opus-5"),
            .branch("main"),
            .plan(Plan(entries: [PlanEntry(text: "Ship it", status: .pending)])),
        ]

        #expect(FeedProjection.rows(from: unhandled).isEmpty)
    }

    @Test
    func `a row is addressed by its own place in the feed`() {
        let rows = FeedProjection.rows(from: [
            .message(markdown: "Same."),
            .title("A title"),
            .message(markdown: "Same."),
        ])

        // Identity cannot be the text, and the ids stay dense over the ROWS.
        #expect(rows.map(\.id) == [0, 1])
    }

    @Test
    func `a call and the outcome that answered it are one row, not two`() {
        let rows = FeedProjection.rows(from: [
            .toolCall(FeedFixture.call("one", tool: "Read", kind: .read, naming: "src/token.ts")),
            .toolCallOutcome(TranscriptFixtures.finished("one", nil)),
        ])

        #expect(rows.count == 1)
    }

    /// The plan is standing state with a surface of its own. Drawing the call that wrote it would
    /// say the same thing twice, in the one place where the second saying is the weaker one.
    @Test
    func `the call that writes the plan is not news of its own`() {
        let rows = FeedProjection.rows(from: [
            .toolCall(FeedFixture.call("plan", tool: "TodoWrite", kind: .plan)),
        ])

        #expect(rows.isEmpty)
    }
}

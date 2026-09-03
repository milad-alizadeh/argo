import ArgoEngine
@testable import ArgoUI
import Testing

/// What the reading says when the Session's Model or Effort moved under it (#558, criterion 6).
///
/// The record's honesty is the whole claim: a Turn that ran on Sonnet, read under a composer now
/// saying Opus, is a Turn the reader attributes to the wrong model. The mark is drawn where the
/// record says it changed, so every Turn above one belongs to what the row replaced.
@Suite("Feed run facts")
struct FeedRunFactTests {
    private func marks(_ events: [TranscriptEvent]) -> [FeedMark] {
        FeedProjection.contents(of: events).compactMap { content in
            guard case let .mark(mark) = content else { return nil }
            return mark
        }
    }

    /// The opening reading is what the composer already states. A row saying so on every Session's
    /// first record would be punctuation before the sentence.
    @Test
    func `the first reading of each fact is not news`() {
        let opening = marks([
            .model("claude-opus-5"),
            .effort(cli: "medium"),
            .message(markdown: "Off we go"),
        ])

        #expect(opening.isEmpty)
    }

    /// The second is. Both halves, and each named — which of the two moved is the whole of the
    /// news, so "settings changed" would say nothing.
    @Test
    func `a change after the opening reading is drawn, and names which fact moved`() {
        let changed = marks([
            .model("claude-opus-5"),
            .effort(cli: "medium"),
            .prompt(text: "Try something cheaper", images: [], atMs: nil),
            .model("claude-sonnet-5"),
            .effort(cli: "high"),
        ])

        #expect(changed == [
            .runFactChanged(.model("claude-sonnet-5")),
            .runFactChanged(.effort("high")),
        ])
        #expect(changed.map(\.words) == ["model · Sonnet 5", "effort · High"])
    }

    /// Each fact is counted on its own: a model that moved before any effort was ever read must
    /// not consume the effort's own opening reading.
    @Test
    func `the two facts are told apart, not counted together`() {
        let changed = marks([
            .model("claude-opus-5"),
            .model("claude-sonnet-5"),
            .effort(cli: "medium"),
        ])

        // The model's second reading is news; the effort's first is not.
        #expect(changed == [.runFactChanged(.model("claude-sonnet-5"))])
    }

    /// Verbatim in the row too, on both halves — the same rule the fact line follows, so a reader
    /// can match one against the other without translating.
    @Test
    func `a value Argo does not recognise states itself in the row`() {
        let changed = marks([
            .model("claude-opus-5"),
            .effort(cli: "medium"),
            .model("claude-mythos-7"),
            .effort(cli: "ludicrous"),
        ])

        #expect(changed.map(\.words) == ["model · claude-mythos-7", "effort · ludicrous"])
    }

    /// It is punctuation, not an act: the boundary ink like every other mark but the expiry, and
    /// it closes no Turn.
    @Test
    func `the mark is punctuation and ends no Turn`() {
        let mark = FeedMark.runFactChanged(.model("claude-sonnet-5"))

        #expect(!mark.endsTurn)
        #expect(mark.ink == .boundary)
        #expect(mark.spoken == "The model changed to Sonnet 5")
    }
}

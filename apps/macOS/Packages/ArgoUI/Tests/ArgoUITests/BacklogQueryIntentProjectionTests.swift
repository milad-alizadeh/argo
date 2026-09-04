@testable import ArgoUI
import Testing

/// Judges `BacklogQueryIntentProjection` against `BacklogQueryIntentCorpus` — a ~100-query
/// stand-in for what a reader really types — on the two axes #1316 asks for: whether the FINAL
/// answer is right, and whether the answer holds still on the way there. The second axis is the
/// real bar (`docs/designs/cockpit-backlog-question.md`): a rule right at the end and wrong four
/// times mid-sentence gives a flickering glyph, which reads worse than no ask at all.
///
/// **The verdict is FAIL.** The numbers below are not aspirational targets — they are what the
/// design's own proposed rule (`?`, or six words and up) does against a realistic corpus, PINNED
/// so a future change to the rule has to touch this file and re-argue the numbers rather than
/// silently drifting. `docs/designs/cockpit-backlog-question.md` names both risks the corpus
/// confirms: "a short question reads as a term" (2 misses with no mark at all) and "a long term
/// reads as a question" (19 of 106 — roughly one term in six), and just under half the corpus
/// makes the glyph change its mind at least once on the way to being typed.
@Suite("Backlog query intent projection")
struct BacklogQueryIntentProjectionTests {
    // MARK: - Accuracy, on the final text

    /// The corpus size #1316 asks for — its own test, so a corpus that shrinks under editing
    /// fails loudly rather than quietly weakening every count pinned below.
    @Test
    func `the corpus holds about a hundred queries`() {
        #expect(BacklogQueryIntentCorpus.entries.count == 106)
    }

    /// The failure the design worried about, made concrete: every one of these is a title or a
    /// long plain term, never a question, and every one crosses the six-word floor. `19` is not a
    /// target to hit — it is what #1316's corpus measures, and the number the verdict rests on.
    @Test
    func `terms of six words or more are misread as questions, at a real rate`() {
        let falsePositives = BacklogQueryIntentCorpus.entries.filter {
            $0.expected == .term && BacklogQueryIntentProjection.kind(of: $0.query) == .question
        }

        #expect(falsePositives.count == 19, "\(falsePositives.map(\.query))")
        // Nothing here is a pasted number or a short phrase — the six-word floor is exactly what
        // catches them, and no other path does.
        #expect(falsePositives.allSatisfy { !$0.query.hasSuffix("?") })
    }

    /// A question read as a term is the feature never appearing — the quieter failure, and the
    /// design's OTHER named risk: "a short question reads as a term." The corpus carries two
    /// deliberate instances of exactly that (`why blocked`, `still open`, no `?`, under six
    /// words) — every other question is caught, including every one that carries its own `?`
    /// regardless of length.
    @Test
    func `only a short question with no mark at all is missed`() {
        let questions = BacklogQueryIntentCorpus.entries.filter { $0.expected == .question }
        let falseNegatives = questions.filter {
            BacklogQueryIntentProjection.kind(of: $0.query) == .term
        }

        #expect(
            Set(falseNegatives.map(\.query)) == ["why blocked", "still open"],
            "\(falseNegatives.map(\.query))",
        )
    }

    /// Restated as one number for the issue write-up: every question that ends in `?`, whatever
    /// its length, must be caught — a trailing `?` is the one signal the rule takes
    /// unconditionally.
    @Test
    func `every question that ends in a question mark is recognised`() {
        let markedQuestions = BacklogQueryIntentCorpus.entries.filter {
            $0.expected == .question && $0.query.hasSuffix("?")
        }

        for entry in markedQuestions {
            #expect(
                BacklogQueryIntentProjection.kind(of: entry.query) == .question,
                "missed: \(entry.query)",
            )
        }
    }

    // MARK: - Stability, over every prefix

    /// The glyph's real bar, and where the rule fails outright. `docs/designs/cockpit-backlog-
    /// question.md` wants the glyph to change ONCE — magnifier to wand, never back and forth
    /// mid-word. Just under half the corpus (`51` of `106`) crosses that line at least once: every
    /// long pasted title flips the instant its sixth word lands, and every embedded `?` (a URL
    /// query string, a quoted title) flips twice — into `.question` at the mark, back out past it.
    @Test
    func `about half the corpus flips glyph state at least once while typing`() {
        let flipping = BacklogQueryIntentCorpus.entries
            .map { ($0, BacklogQueryIntentProjection.flips(typing: $0.query)) }
            .filter { $0.1 > 0 }

        #expect(flipping.count == 51)
    }

    /// The worse case: a glyph that changes its mind more than once. Every instance in the corpus
    /// is a `?` embedded mid-string (a URL query, a quoted title) rather than at the end — the
    /// prefix crosses into `.question` when the `?` is typed, then back to `.term` once more text
    /// follows it without another six-word run.
    @Test
    func `a small set of embedded question marks flip the glyph twice`() {
        let multiFlipping = BacklogQueryIntentCorpus.entries
            .map { ($0, BacklogQueryIntentProjection.flips(typing: $0.query)) }
            .filter { $0.1 > 1 }

        #expect(multiFlipping.count == 3, "\(multiFlipping.map { "\($0.0.query) (\($0.1))" })")
        #expect(multiFlipping.allSatisfy { $0.0.group == "awkward: url query" })
    }
}

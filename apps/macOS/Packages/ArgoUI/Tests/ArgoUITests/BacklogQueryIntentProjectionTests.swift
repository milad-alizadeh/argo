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
/// silently drifting. `docs/designs/cockpit-backlog-question.md` names this exact risk — "a long
/// term reads as a question" — and the corpus confirms it: one term in five is misread, and over
/// half the corpus makes the glyph change its mind at least once on the way to being typed.
@Suite("Backlog query intent projection")
struct BacklogQueryIntentProjectionTests {
    // MARK: - Accuracy, on the final text

    /// The failure the design worried about, made concrete: every one of these is a title or a
    /// long plain term, never a question, and every one crosses the six-word floor. `21` is not a
    /// target to hit — it is what #1316's corpus measures, and the number the verdict rests on.
    @Test
    func `terms of six words or more are misread as questions, at a real rate`() {
        let falsePositives = BacklogQueryIntentCorpus.entries.filter {
            $0.expected == .term && BacklogQueryIntentProjection.kind(of: $0.query) == .question
        }

        #expect(falsePositives.count == 21, "\(falsePositives.map(\.query))")
        // Nothing here is a pasted number or a short phrase — the six-word floor is exactly what
        // catches them, and no other path does.
        #expect(falsePositives.allSatisfy { !$0.query.hasSuffix("?") })
    }

    /// A question read as a term is the feature never appearing — the quieter failure. Unlike the
    /// false positives above, this direction is clean: every question in the corpus that carries
    /// its own `?` is caught, and the only misses are short questions with no mark at all, which
    /// is the rule's known, accepted gap.
    @Test
    func `no question is missed except a short one carrying no mark`() {
        let questions = BacklogQueryIntentCorpus.entries.filter { $0.expected == .question }
        let falseNegatives = questions.filter {
            BacklogQueryIntentProjection.kind(of: $0.query) == .term
        }

        #expect(falseNegatives.isEmpty, "\(falseNegatives.map(\.query))")
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
    /// mid-word. Over half the corpus (`53` of `104`) crosses that line at least once: every long
    /// pasted title flips the instant its sixth word lands, and every embedded `?` (a URL query
    /// string, a quoted title) flips twice — into `.question` at the mark, back out past it.
    @Test
    func `over half the corpus flips glyph state at least once while typing`() {
        let flipping = BacklogQueryIntentCorpus.entries
            .map { ($0, BacklogQueryIntentProjection.flips(typing: $0.query)) }
            .filter { $0.1 > 0 }

        #expect(flipping.count == 53)
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

    // MARK: - The verdict, as one report

    /// Not a pass/fail gate — every number here is pinned by the tests above, and this just
    /// restates them as the report #1316 asks to be stated on the issue. Read the suite doc
    /// comment for the verdict itself: FAIL, on both directions the design named as its risk.
    @Test
    func `the corpus verdict`() {
        let entries = BacklogQueryIntentCorpus.entries
        let falsePositives = entries.filter {
            $0.expected == .term && BacklogQueryIntentProjection.kind(of: $0.query) == .question
        }
        let falseNegatives = entries.filter {
            $0.expected == .question && BacklogQueryIntentProjection.kind(of: $0.query) == .term
        }
        let flipCounts = entries.map { ($0, BacklogQueryIntentProjection.flips(typing: $0.query)) }
        let anyFlip = flipCounts.filter { $0.1 > 0 }
        let multiFlip = flipCounts.filter { $0.1 > 1 }

        #expect(entries.count == 104)
        #expect(falsePositives.count == 21)
        #expect(falseNegatives.isEmpty)
        #expect(anyFlip.count == 53)
        #expect(multiFlip.count == 3)
    }
}
